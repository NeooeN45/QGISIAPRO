# -*- coding: utf-8 -*-
"""Test d'installation des dépendances NVIDIA"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'QGISIA2'))

from nvidia_deps_installer import install_nvidia_deps, get_install_status

logs = []
def progress_cb(msg):
    logs.append(msg)
    print(f'[PROGRESS] {msg}')

print('=== Démarrage installation NVIDIA deps ===')
print(f'Python: {sys.executable}')
print(f'Platform: {sys.platform}')
print('')

result = install_nvidia_deps(progress_cb=progress_cb, force=True)

print('\n=== Résultat ===')
print(f'Success: {result.get("success")}')
print(f'Error: {result.get("error", "N/A")}')
print(f'Already installed: {result.get("already_installed", False)}')

print('\n=== Logs complets ===')
for log in result.get('logs', []):
    print(f"[{log.get('stage')}] {log.get('level', 'info').upper()}: {log.get('message')}")

if result.get('success'):
    print('\n=== Vérification post-installation ===')
    try:
        import torch
        print(f'torch version: {torch.__version__}')
        print(f'CUDA available: {torch.cuda.is_available()}')
        if torch.cuda.is_available():
            print(f'CUDA version: {torch.version.cuda}')
    except ImportError as e:
        print(f'torch non importable: {e}')
    
    try:
        import earth2studio
        print(f'earth2studio importé avec succès')
    except ImportError as e:
        print(f'earth2studio non importable: {e}')
