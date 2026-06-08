#!/usr/bin/env python3
"""Patch Chat.tsx — intègre GeoParticlesBackground (lazy import + rendu)."""
import re, sys

CHAT = "src/components/Chat.tsx"

content = open(CHAT, encoding="utf-8").read()

# 1. Ajouter le lazy import après WorkspaceSidebar
old_import = 'const WorkspaceSidebar = lazy(() => import("./WorkspaceSidebar"));'
new_import = (
    'const WorkspaceSidebar = lazy(() => import("./WorkspaceSidebar"));\n'
    'const GeoParticlesBackground = lazy(() => import("./GeoParticlesBackground"));'
)
if "GeoParticlesBackground" not in content:
    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print("✓ lazy import ajouté")
    else:
        print("✗ WorkspaceSidebar import non trouvé", file=sys.stderr)
        sys.exit(1)
else:
    print("~ GeoParticlesBackground déjà présent, skip import")

# 2. Ajouter le composant juste après <div className="bg-mesh" />
old_mesh = '<div className="bg-mesh" />'
new_mesh = (
    '<div className="bg-mesh" />\n'
    '      <Suspense fallback={null}>\n'
    '        <GeoParticlesBackground isDark={true} />\n'
    '      </Suspense>'
)
if "GeoParticlesBackground isDark" not in content:
    if old_mesh in content:
        content = content.replace(old_mesh, new_mesh, 1)
        print("✓ rendu GeoParticlesBackground ajouté")
    else:
        print("✗ bg-mesh div non trouvée", file=sys.stderr)
        sys.exit(1)
else:
    print("~ rendu déjà présent, skip")

open(CHAT, "w", encoding="utf-8").write(content)
print("✓ Chat.tsx sauvegardé")
