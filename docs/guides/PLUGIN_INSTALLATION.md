# Installation du Plugin GeoSylva AI pour QGIS

## Méthode 1: Installation via ZIP (Recommandée)

1. **Téléchargez le ZIP**: `geoai_assistant.zip` dans le dépôt GitHub
2. **Dans QGIS 4.0.0**, allez dans **Plugins > Gérer et installer les plugins**
3. **Cliquez sur "Installer depuis ZIP"**
4. **Sélectionnez le fichier** `geoai_assistant.zip`
5. **Cliquez sur "Installer le plugin"**
6. **Cochez la case** à côté de "GeoSylva AI" pour l'activer
7. **Redémarrez QGIS**

## Méthode 2: Installation depuis le dépôt GitHub

1. **Dans QGIS 4.0.0**, allez dans **Plugins > Gérer et installer les plugins**
2. **Cliquez sur l'onglet "Paramètres"**
3. **Cliquez sur "Ajouter un dépôt de plugins"**
4. **Entrez les informations suivantes**:
   - **Nom**: GeoSylva AI
   - **URL**: https://github.com/NeooeN45/QGISIA2
5. **Cliquez sur "OK"**
6. **Allez dans l'onglet "Tous"**
7. **Cherchez "GeoSylva AI"**
8. **Cliquez sur "Installer le plugin"**

## Utilisation

1. **Dans QGIS**, cliquez sur **Plugins > GeoSylva AI > Ouvrir**

2. **Une fenêtre de lancement superbe s'affichera** avec:
   - Logo et titre du plugin
   - Cartes d'information sur les fonctionnalités
   - Bouton de lancement avec design moderne
   - Chemin du projet détecté automatiquement
   - URL du serveur
   - Instructions

3. **Cliquez sur "🚀 Lancer GeoSylva AI"**
   - Le serveur de développement démarrera automatiquement (si pas déjà lancé)
   - Le plugin attendra que le serveur soit prêt (max 30 secondes)
   - Le navigateur externe s'ouvrira automatiquement
   - L'interface web sera accessible sur http://localhost:5173

**Note**: Le serveur démarre automatiquement! Vous n'avez plus besoin de lancer `npm run dev` manuellement.

## Fonctionnalités

- 🤖 **Assistant Conversationnel**: Discutez avec votre projet QGIS en langage naturel
- 🗺️ **Sources Officielles**: IGN, API Carto, geo.api.gouv.fr, Copernicus, NASA
- ⚡ **Automatisation PyQGIS**: Génération et exécution automatique de scripts
- 🌐 **Navigateur Externe**: Interface web moderne dans votre navigateur par défaut
- 🎨 **Interface Superbe**: Design moderne et intuitif dans QGIS

## Mises à jour

Le plugin sera automatiquement mis à jour depuis le dépôt GitHub si vous utilisez la méthode d'installation depuis le dépôt.

Pour les mises à jour manuelles via ZIP:
1. Téléchargez la nouvelle version du ZIP
2. Désinstallez l'ancienne version
3. Réinstallez avec le nouveau ZIP

## Configuration

L'URL du serveur par défaut est `http://localhost:5173`. Vous pouvez la modifier dans le fichier `qgis_plugin/geoai_assistant.py` si nécessaire.

## Support

Pour toute question ou problème, ouvrez une issue sur le dépôt GitHub: https://github.com/NeooeN45/QGISIA2
