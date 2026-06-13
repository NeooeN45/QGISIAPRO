# QGISIA+ MCP Server (Sprint 6)

Le serveur **Model Context Protocol** expose les outils QGIS du plugin à des clients IA externes (Claude Desktop, Cursor, Cline, Continue, ChatGPT Desktop) via JSON-RPC stdio.

## Architecture

```
┌─────────────────┐       stdio       ┌──────────────────┐    HTTP POST    ┌─────────────────┐
│ Claude Desktop  │ <───────────────> │  mcp_server.py   │ ──────────────> │ Plugin QGIS     │
│ Cursor / Cline  │     JSON-RPC      │  (ce projet)     │   /api/qgis/*   │ dev_server.py   │
└─────────────────┘                   └──────────────────┘                  └─────────────────┘
```

## Installation

```powershell
pip install mcp httpx
```

## Lancement manuel (debug)

```powershell
python -m QGISIA2.mcp_server
```

Le serveur écoute sur stdin/stdout selon le protocole MCP.

## Configuration Claude Desktop

Édite `%APPDATA%\Claude\claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "qgisia-plus": {
      "command": "python",
      "args": ["-m", "QGISIA2.mcp_server"],
      "env": {
        "QGISIA_BRIDGE_URL": "http://localhost:8157",
        "PYTHONPATH": "C:/chemin/vers/QGISIA2/parent"
      }
    }
  }
}
```

Redémarre Claude Desktop. Les outils QGISIA+ apparaissent dans la liste des outils disponibles.

## Configuration Cursor / Cline

Voir la doc respective des extensions pour la configuration MCP — le format est identique.

## Outils exposés

| Outil | Description |
|---|---|
| `loadHubEauStations` | Stations qualité/hydro/piézo Hub'Eau FR |
| `loadGbifOccurrences` | Occurrences d'espèces GBIF (biodiversité mondiale) |
| `loadDvfTransactions` | Transactions immobilières DVF FR |
| `segmentRasterWithSAM` | Segmentation Segment Anything (auto ou prompt texte) |
| `forecastWeatherWithEarth2` | Prévisions météo IA NVIDIA Earth-2 |
| `exportProjectReport` | Export rapport PDF/DOCX du projet QGIS |
| `getLayersList` | Liste des couches du projet courant |
| `runScript` | Exécution PyQGIS arbitraire (power user) |

## Flux de données

1. Le client MCP appelle `tools/list` → le serveur renvoie le catalogue
2. Le client appelle `tools/call(name, arguments)` 
3. Le serveur traduit en HTTP POST `/api/qgis/<endpoint>` vers le plugin QGIS
4. Le plugin exécute via `@BridgeSlot` et retourne le résultat texte
5. Le serveur encapsule en `TextContent` MCP pour le client

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `QGISIA_BRIDGE_URL` | `http://localhost:8157` | URL du dev_server ou plugin actif |

## Sécurité

⚠️ `runScript` exécute du PyQGIS arbitraire. Réserve cet outil aux environnements de confiance ou désactive-le en commentant l'entrée dans `TOOL_CATALOG`.

Le serveur ne fait aucune authentification : protège l'accès au port HTTP 8157 (firewall, ou bind sur 127.0.0.1 uniquement).

## Tests

```powershell
python -m pytest tests/test_mcp_server.py -v
```

17 tests unitaires sans dépendance au SDK MCP (mocks httpx).
