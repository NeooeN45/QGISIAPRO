# -*- coding: utf-8 -*-
"""
Serveur de dev local — teste le backend Gateway sans QGIS.

Usage:
    python dev_server.py

Ouvre ensuite http://localhost:8157 dans ton navigateur.
"""
import sys
import os
import json
import threading
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
PLUGIN_DIR = ROOT / "QGISIA2"
WEB_DIR = PLUGIN_DIR / "web"

# Injecte le plugin dans le path
sys.path.insert(0, str(PLUGIN_DIR))

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("dev_server")

# ─── Import llm_installer (standalone) ────────────────────────────────────────
import llm_installer

# ─── Import llm_gateway si vendor prêt ────────────────────────────────────────
def _load_gateway():
    try:
        import llm_gateway
        return llm_gateway
    except Exception as e:
        log.warning(f"llm_gateway non disponible: {e}")
        return None

# ─── Handler HTTP ─────────────────────────────────────────────────────────────
class DevHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        log.debug(format % args)

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path):
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }
        ct = content_types.get(path.suffix, "application/octet-stream")
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        route = self.path.split("?")[0]

        # ── API routes ──
        if route == "/api/llm/health":
            gw = _load_gateway()
            status = gw.health() if gw else {"vendor_ready": llm_installer.is_vendor_ready()}
            self._send_json(200, {"ok": True, **status})
            return

        if route == "/api/llm/install_status":
            self._send_json(200, {"ok": True, **llm_installer.get_install_status()})
            return

        if route == "/api/llm/models":
            gw = _load_gateway()
            if not gw:
                self._send_json(503, {"ok": False, "error": "gateway_not_ready"})
                return
            self._send_json(200, {"ok": True, "aliases": gw.list_aliases()})
            return

        if route == "/api/llm/budget":
            gw = _load_gateway()
            if gw:
                self._send_json(200, {"ok": True, **gw.get_budget()})
            else:
                self._send_json(200, {"ok": True, "day": "N/A", "total_usd": 0.0, "request_count": 0})
            return

        if route == "/api/llm/diagnostic":
            import platform, subprocess
            diag = {
                "python_version": sys.version,
                "platform": platform.platform(),
                "plugin_dir": str(llm_installer.PLUGIN_DIR),
                "vendor_dir": str(llm_installer.VENDOR_DIR),
                "vendor_exists": llm_installer.VENDOR_DIR.exists(),
                "marker_exists": llm_installer.MARKER_FILE.exists(),
                "vendor_ready": llm_installer.is_vendor_ready(),
                "sys_executable": sys.executable,
            }
            try:
                r = subprocess.run(
                    [sys.executable, "-m", "pip", "--version"],
                    capture_output=True, text=True, timeout=10,
                )
                diag["pip_path"] = r.stdout.strip() if r.returncode == 0 else f"error: {r.stderr}"
            except Exception as e:
                diag["pip_path"] = f"exception: {e}"
            if llm_installer.DEBUG_LOG_FILE.exists():
                diag["debug_file"] = str(llm_installer.DEBUG_LOG_FILE)
            self._send_json(200, {"ok": True, **diag})
            return

        # ── Static files ──
        if route == "/" or route == "/index.html":
            index = WEB_DIR / "index.html"
            if index.exists():
                self._send_file(index)
            else:
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(b"<h1>Dev server OK</h1><p>Build the frontend first: <code>npm run build</code></p>")
            return

        # Fichiers statiques dans web/
        file_path = WEB_DIR / route.lstrip("/")
        if file_path.exists() and file_path.is_file():
            self._send_file(file_path)
            return

        # SPA fallback
        index = WEB_DIR / "index.html"
        if index.exists():
            self._send_file(index)
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        route = self.path.split("?")[0]
        body = self._read_body()

        if route == "/api/llm/install":
            llm_installer._log("api", "Installation démarrée via dev_server")
            thread = llm_installer.install_async()
            self._send_json(202, {"ok": True, "status": "installing", "thread_alive": thread.is_alive()})
            return

        if route == "/api/llm/install_sync":
            log.info("Installation synchrone démarrée...")
            try:
                result = llm_installer.install_if_needed(force=body.get("force", True))
                self._send_json(200, {"ok": True, **result})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        if route == "/api/agent/memory":
            from QGISIA2.agent_memory import get_memory
            mem = get_memory()
            self._send_json(200, {"ok": True, **mem.stats()})
            return

        if route == "/api/agent/memory/search":
            from QGISIA2.agent_memory import get_memory
            mem = get_memory()
            results = mem.search(body.get("query", ""), top_k=body.get("top_k", 5))
            self._send_json(200, {"ok": True, "results": [
                {"key": e.key, "value": e.value, "category": e.category,
                 "confidence": e.confidence, "tags": e.tags}
                for e in results
            ]})
            return

        if route == "/api/agent/guardrails/check":
            from QGISIA2.agent_guardrails import get_guardrails
            gr = get_guardrails()
            code = body.get("code", "")
            result = gr.check_pyqgis_code(code) if code else gr.check_input(body.get("user_message", ""))
            self._send_json(200, {"ok": True,
                "passed": result.passed, "risk_level": result.risk_level.value,
                "rule": result.rule_triggered, "message": result.message,
            })
            return

        if route == "/api/agent/plan":
            from QGISIA2.agent_runner import AgentRunner, AgentMode
            gw = _load_gateway()
            if not gw:
                self._send_json(503, {"ok": False, "error": "gateway_not_ready"})
                return
            runner = AgentRunner(mode=AgentMode.AUTO if body.get("auto_mode") else AgentMode.PLAN_CONFIRM)
            runner.set_llm_chat(gw.chat)
            guard = runner.validate_input(body.get("user_request", ""))
            if not guard.passed:
                self._send_json(400, {"ok": False, "blocked": True, "message": guard.message})
                return
            plan = runner.build_plan(
                body.get("user_request", ""), body.get("layer_context", ""),
                body.get("api_keys", {}), body.get("model", "smart-default"),
            )
            self._send_json(200, {"ok": True, "plan_id": plan.plan_id, "status": plan.status,
                "summary": plan.summary,
                "steps": [{"step_id": s.step_id, "description": s.description,
                            "action_type": s.action_type, "risk_level": s.risk_level.value,
                            "status": s.status.value} for s in plan.steps],
            })
            return

        if route == "/api/llm/chat":
            gw = _load_gateway()
            if not gw:
                self._send_json(503, {"ok": False, "error": "gateway_not_ready"})
                return
            try:
                model = body.get("model", "fast-local")
                messages = body.get("messages", [])
                api_keys = body.get("api_keys", {})
                temperature = body.get("temperature", 0.3)
                resp = gw.chat(model=model, messages=messages, api_keys=api_keys, temperature=temperature)
                self._send_json(200, {"ok": True, **resp})
            except Exception as e:
                log.error(f"Chat error: {e}", exc_info=True)
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        self._send_json(404, {"error": f"Unknown route: {route}"})


# ─── Main ──────────────────────────────────────────────────────────────────────
def main():
    port = 8157
    print(f"""
╔══════════════════════════════════════════════════════════╗
║             QGISIA+ — Serveur de Dev Local               ║
╠══════════════════════════════════════════════════════════╣
║  URL:        http://localhost:{port}                       ║
║  Plugin:     {str(PLUGIN_DIR)[:48]}
║  Vendor OK:  {llm_installer.is_vendor_ready()}
║                                                          ║
║  Ctrl+C pour arrêter                                     ║
╚══════════════════════════════════════════════════════════╝
""")
    if not llm_installer.is_vendor_ready():
        log.warning("⚠️  Vendor non installé. Lance l'installation depuis l'UI.")

    server = HTTPServer(("0.0.0.0", port), DevHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✅ Serveur arrêté.")


if __name__ == "__main__":
    main()
