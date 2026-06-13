"""
Réinstallation sûre du plugin QGISIA2 dans QGIS (3.x ou 4.x).

À coller dans la console Python de QGIS :
Plugins → Python Console (Ctrl+Alt+P) → onglet Editor → coller → Run

Stratégie : crée un LIEN (symlink/junction) du dossier plugins vers le source
du repo, au lieu de copier. Avantages :
- Le plugin reste toujours synchronisé avec le repo (pas de copie périmée).
- Élimine le risque de récursion `QGISIA2/QGISIA2/...` qu'un copytree provoque
  quand la destination est un lien pointant vers le source (la copie se copie
  alors dans elle-même jusqu'à saturer le disque).

Gardes de sécurité :
- Refuse si source == destination ou si l'un est contenu dans l'autre.
- Sur une destination déjà liée, supprime UNIQUEMENT le lien (jamais rmtree à
  travers un lien, ce qui pourrait effacer le source).
- Fallback copie (si lien impossible) en excluant data/, vendor/, web volumineux,
  __pycache__ et tout sous-dossier QGISIA2 — donc sans bombe récursive possible.
"""

import os
import shutil
import subprocess
from pathlib import Path

PLUGIN_NAME = "QGISIA2"

# Source du projet (à adapter si le repo est ailleurs).
SOURCE_DIR = Path(
    os.path.expanduser("~"),
    "Desktop", "Micro Entreprise", "04_PROJETS_EN_COURS",
    "Projet", "QGISIA", "QGISIA2",
).resolve()


def _detect_profile_plugins_dir() -> Path:
    """Dossier plugins du profil QGIS courant (QGIS3 ou QGIS4 auto-détecté)."""
    qgis_folder = "QGIS3"
    try:
        from qgis.core import Qgis
        major = int(str(Qgis.QGIS_VERSION_INT)[0])
        qgis_folder = f"QGIS{major}"
    except Exception:
        pass
    return Path(
        os.environ["APPDATA"], "QGIS", qgis_folder,
        "profiles", "default", "python", "plugins",
    )


def _is_link(path: Path) -> bool:
    """Symlink OU junction Windows (reparse point)."""
    if path.is_symlink():
        return True
    try:
        return bool(os.stat(path, follow_symlinks=False).st_reparse_tag)  # type: ignore[attr-defined]
    except (OSError, AttributeError):
        return False


def _remove_destination(dest: Path) -> None:
    """Supprime la destination en sécurité (lien => unlink ; dossier réel => rmtree)."""
    if not dest.exists() and not _is_link(dest):
        return
    if _is_link(dest):
        # NE JAMAIS rmtree à travers un lien : supprimer seulement le lien.
        try:
            dest.unlink()
        except (OSError, PermissionError):
            os.rmdir(dest)  # junction de dossier
        print(f"    [OK] lien existant supprime : {dest}")
    else:
        shutil.rmtree(dest)
        print(f"    [OK] dossier existant supprime : {dest}")


def _ignore_heavy(_dir, names):
    """Exclut les dossiers lourds/regenerables et toute récursion QGISIA2."""
    excluded = {"data", "vendor", "__pycache__", ".git", PLUGIN_NAME}
    return [n for n in names if n in excluded or n.endswith((".pyc", ".pyo"))]


def reinstall() -> None:
    source = SOURCE_DIR
    if not source.is_dir():
        raise SystemExit(f"[X] SOURCE_DIR introuvable : {source}\n    -> Modifiez SOURCE_DIR.")

    dest = (_detect_profile_plugins_dir() / PLUGIN_NAME)
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Garde anti-récursion : source et destination ne doivent pas se chevaucher.
    src_res = source.resolve()
    dst_res = dest.resolve() if dest.exists() else dest
    if src_res == dst_res or src_res in dst_res.parents or dst_res in src_res.parents:
        raise SystemExit(
            f"[X] Source et destination se chevauchent — abandon (anti-récursion).\n"
            f"    source = {src_res}\n    dest   = {dst_res}"
        )

    # Décharger le plugin si chargé.
    try:
        from qgis.utils import unloadPlugin
        unloadPlugin(PLUGIN_NAME)
        print(f"[1/3] {PLUGIN_NAME} déchargé")
    except Exception as exc:
        print(f"[1/3] Non chargé ({exc})")

    print("[2/3] Installation du lien...")
    _remove_destination(dest)
    try:
        os.symlink(source, dest, target_is_directory=True)
        print(f"    [OK] symlink : {dest} -> {source}")
    except (OSError, NotImplementedError) as exc:
        # Pas de privilège symlink : tenter une junction, sinon copie filtrée.
        # subprocess.run en forme liste (pas de shell) — pas d'injection ;
        # mklink est un builtin cmd.exe, d'où l'appel via "cmd /c".
        print(f"    symlink impossible ({exc}) — fallback...")
        proc = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(dest), str(source)],
            capture_output=True, text=True,
        )
        if proc.returncode == 0 and dest.exists():
            print(f"    [OK] junction : {dest} -> {source}")
        else:
            shutil.copytree(source, dest, ignore=_ignore_heavy, dirs_exist_ok=True)
            print(f"    [OK] copie filtrée (sans data/vendor) : {dest}")

    print("[3/3] Rechargement...")
    try:
        from qgis.utils import loadPlugin, startPlugin
        loadPlugin(PLUGIN_NAME)
        startPlugin(PLUGIN_NAME)
        print(f"    [OK] {PLUGIN_NAME} redémarré")
    except Exception as exc:
        print(f"    [!] Rechargez manuellement ({exc})")

    print("\n[OK] Plugin QGISIA2 réinstallé (lien vers le repo, toujours à jour).")


# Exécuté au chargement (collage dans la console QGIS) comme en script.
reinstall()
