# Scénario : Création Automatique d'un Plan Simple de Gestion (PSG) Forestier - Version Avancée

## Contexte
Un technicien forestier de l'ONF doit créer un Plan Simple de Gestion (PSG) pour la forêt de Compiègne. L'utilisateur fournit des données spécifiques sur certaines parcelles (parcelles 45, 67, 89, 112 de la forêt de Compiègne) et demande une carte qui mette en valeur ces parcelles spécifiques tout en montrant le contexte de la forêt entière.

## Scénario Complet - Version Avancée

### Étape 1 : Demande Utilisateur avec Données Spécifiques
**Utilisateur** : *"Crée un PSG pour la forêt de Compiègne. Je dois mettre en valeur les parcelles 45, 67, 89 et 112. Les données de ces parcelles sont : parcelle 45 (12.5 ha, chêne, 80 ans, 350 m³/ha), parcelle 67 (8.3 ha, hêtre, 120 ans, 420 m³/ha), parcelle 89 (15.2 ha, mélange chêne-hêtre, 95 ans, 380 m³/ha), parcelle 112 (10.1 ha, résineux, 60 ans, 300 m³/ha). Utilise les normes ONF 2024."*

### Étape 2 : Analyse et Planification (Standard Matcher + Task Decomposer)
- **Standard Matcher** analyse la demande et sélectionne automatiquement :
  - Norme : `onf-2024`
  - Confiance : 95%
  - Tags : forest, management, PSG, parcel-specific

- **Task Decomposer** décompose la demande en plan d'exécution complexe :
  ```
  1. Récupérer le document d'aménagement de la forêt de Compiègne
  2. Télécharger et analyser le document
  3. Identifier les parcelles via flux de cartes (WFS ONF, IGN)
  4. Faire correspondre les données utilisateur avec les parcelles identifiées
  5. Extraire les parcelles concernées avec mise en valeur
  6. Créer des couches multiples pour être sûr de bien faire
  7. Appliquer la symbologie ONF adaptée aux données
  8. Calculer les surfaces et volumes
  9. Créer la carte principale avec mise en valeur
  10. Créer les cartes thématiques (peuplement, essences, âges, volumes)
  11. Générer les tableaux de données pour les parcelles sélectionnées
  12. Créer la mise en page PSG
  13. Exporter en PDF
  ```

### Étape 3 : Récupération du Document d'Aménagement (Forest Document Retriever)
- **Forest Document Retriever** effectue :
  - Recherche dans les sources officielles (ONF, IGN, GEOFONCIER)
  - Document trouvé : PSG Forêt de Compiègne 2024 (ONF Picardie)
  - Téléchargement : 45 Mo (ZIP)
  - Extraction : 23 fichiers extraits
  - Analyse : 234 parcelles identifiées dans le document
  - Durée : 18 secondes

### Étape 4 : Identification des Parcelles via Flux de Cartes (Parcel Identification Service)
- **Parcel Identification Service** interroge les services de cartes :
  - Service WFS ONF : 234 parcelles trouvées
  - Service WFS IGN : 231 parcelles trouvées
  - Service GEOFONCIER : 228 parcelles trouvées
  - Fusion et déduplication : 234 parcelles uniques
  - Filtre par forêt : 234 parcelles de Compiègne
  - Durée : 8 secondes

### Étape 5 : Correspondance Données/Parcelles (Data Parcel Matcher)
- **Data Parcel Matcher** fait correspondre les données utilisateur :
  - Parcelle 45 : ID "45" → Correspondance exacte (score: 100)
  - Parcelle 67 : ID "67" → Correspondance exacte (score: 100)
  - Parcelle 89 : ID "89" → Correspondance exacte (score: 100)
  - Parcelle 112 : ID "112" → Correspondance exacte (score: 100)
  - Vérification des données fournies par rapport aux données officielles :
    - Surface : correspondance à ±5%
    - Essence : correspondance exacte
    - Âge : correspondance à ±2 ans
    - Volume : correspondance à ±10%
  - Confiance moyenne : 98%
  - Durée : 2 secondes

### Étape 6 : Extraction Sélective (Selective Parcel Extractor)
- **Selective Parcel Extractor** crée les couches :
  - Mode : "all_with_highlight" (toutes les parcelles avec mise en valeur)
  - Couche 1 : "Parcelles_Foret_Compiègne" (234 parcelles)
  - Couche 2 : "Parcelles_MiseEnValeur" (4 parcelles sélectionnées)
  - Couche 3 : "Parcelles_Sélectionnées_Seules" (4 parcelles uniquement)
  - Style de mise en valeur : contour rouge 3px, remplissage semi-transparent
  - Durée : 5 secondes

### Étape 7 : Géotraitement Avancé (Geoprocessing Manager + Spatial Analysis Manager)
- **Geoprocessing Manager** effectue :
  - Calcul des surfaces exactes des 4 parcelles sélectionnées
  - Calcul des volumes totaux par essence
  - Création de buffers pour les zones sensibles
  - Intersection avec les limites de la forêt

- **Spatial Analysis Manager** effectue :
  - Calcul des centroïdes pour les étiquettes des 4 parcelles
  - Création d'une grille de 500m pour l'analyse contextuelle
  - Comptage des arbres par hectare
  - Calcul des distances entre parcelles sélectionnées

### Étape 8 : Application de la Symbologie Adaptée (Symbology Applier)
- **Symbology Applier** applique :
  - Couche principale (234 parcelles) : Gradué par volume (ONF standard)
  - Couche mise en valeur (4 parcelles) : Contour rouge 3px, remplissage rgba(255,0,0,0.3)
  - Couche sélectionnées seules : Symbologie ONF avec étiquettes personnalisées
  - Étiquettes : ID + Essence + Surface + Âge + Volume
  - Durée : 6 secondes

### Étape 9 : Validation (Geospatial Validator + Result Validator)
- **Geospatial Validator** valide :
  - Géométrie : 0 erreur
  - Topologie : 0 erreur
  - Attributs : 0 avertissement (toutes les données correspondent)
  - CRS : EPSG:2154 (Lambert 93) ✓
  - Complétude : 100%

- **Result Validator** vérifie :
  - Complétude : 4 parcelles identifiées ✓
  - Qualité : Résolution 300 DPI ✓
  - Conformité : Norme ONF respectée ✓
  - Consistance : Échelles cohérentes ✓
  - Correspondance données : 98% ✓
  - Score global : 96/100

### Étape 10 : Création des Mises en Page (Layout Creator + Layout Template Manager)
- **Layout Template Manager** utilise le template PSG standard :
  - Template : `psg_with_highlight`
  - Variables : forest_name="Compiègne", surface=46.1, parcel_count=4, date="2024-06-15"

- **Layout Creator** génère 5 mises en page :
  1. **Carte principale avec mise en valeur**
     - Titre : "Carte Principale - Forêt de Compiègne (Parcelles Sélectionnées)"
     - Carte principale (234 parcelles) + mise en valeur (4 parcelles)
     - Légende complète + échelle + flèche du nord
     - Tableau des 4 parcelles sélectionnées avec toutes les données
     - Encadré "Parcelles analysées : 4/234"
     - Signature ONF

  2. **Carte de peuplement**
     - Titre : "Carte de Peuplement - Forêt de Compiègne"
     - Carte principale + légende + échelle + flèche du nord
     - Tableau des surfaces par peuplement
     - Mise en valeur des 4 parcelles sélectionnées
     - Signature ONF

  3. **Carte des essences**
     - Titre : "Carte des Essences - Forêt de Compiègne"
     - Carte principale + légende + diagramme circulaire
     - Tableau des volumes par essence
     - Mise en valeur des 4 parcelles sélectionnées
     - Signature ONF

  4. **Carte des âges**
     - Titre : "Carte des Âges - Forêt de Compiègne"
     - Carte principale + légende + histogramme
     - Tableau des classes d'âge
     - Mise en valeur des 4 parcelles sélectionnées
     - Signature ONF

  5. **Carte des volumes**
     - Titre : "Carte des Volumes - Forêt de Compiègne"
     - Carte principale + légende + graphique
     - Tableau des volumes totaux
     - Mise en valeur des 4 parcelles sélectionnées
     - Signature ONF

### Étape 11 : Génération des Tableaux de Données (Attribute Manager)
- **Attribute Manager** génère :
  - Tableau détaillé des 4 parcelles sélectionnées
  - Tableau comparatif avec les données fournies par l'utilisateur
  - Tableau statistique (moyenne, min, max)
  - Export CSV pour analyse ultérieure

### Étape 12 : Export (Export Print Manager + Multi-Format Export Manager)
- **Export Print Manager** exporte :
  - Format : PDF
  - Résolution : 300 DPI
  - Taille A4
  - Compression : oui
  - Durée totale : 12 secondes

- **Multi-Format Export Manager** exporte aussi :
  - GeoJSON pour web mapping (avec les 4 parcelles sélectionnées)
  - Shapefile pour compatibilité (toutes les couches)
  - KML pour Google Earth

### Étape 13 : Rapport et Documentation (Report Generator + Advanced Logger)
- **Report Generator** génère :
  - Rapport de l'opération (3 pages)
  - Rapport de validation (2 pages)
  - Rapport de correspondance données/parcelles (2 pages)
  - Rapport de session (4 pages)
  - Total : 11 pages de documentation

- **Advanced Logger** enregistre :
  - 78 opérations loggées
  - 24 métriques enregistrées
  - 0 erreur critique
  - Durée totale : 3 minutes 42 secondes

### Étape 14 : Sauvegarde (Session Manager + Project Manager + Cache Manager)
- **Session Manager** sauvegarde :
  - Session : `psg_compiègne_2024_parcelles`
  - Snapshots : 5 (initial, après téléchargement, après identification, après extraction, final)
  - Auto-save : activé (toutes les 60 secondes)

- **Project Manager** crée :
  - Projet : "PSG Forêt de Compiègne 2024 - Parcelles 45,67,89,112"
  - Tags : psg, onf, forêt, 2024, parcelles_spécifiques
  - Espace de travail : "Projets ONF Picardie"

- **Cache Manager** met en cache :
  - Document d'aménagement (TTL : 24 heures)
  - Résultats WFS (TTL : 1 heure)
  - Couches stylées (TTL : 1 heure)
  - Résultats de géotraitement (TTL : 30 minutes)
  - Correspondances données/parcelles (TTL : 24 heures)

## Résultat Final

### Fichiers Générés
```
/output/psg_compiègne_2024_parcelles/
├── carte_principale.pdf (2.8 Mo)
├── carte_peuplement.pdf (2.3 Mo)
├── carte_essences.pdf (2.1 Mo)
├── carte_ages.pdf (1.8 Mo)
├── carte_volumes.pdf (2.0 Mo)
├── rapport_operation.pdf (156 Ko)
├── rapport_validation.pdf (98 Ko)
├── rapport_correspondance.pdf (134 Ko)
├── rapport_session.pdf (245 Ko)
├── tableau_parcelles.csv (12 Ko)
├── data_selected.geojson (890 Ko)
├── data_all.shp (3.4 Mo)
├── data_all.kml (1.2 Mo)
└── document_aménagement.zip (45 Mo)
```

### Métriques
- **Durée totale** : 3 minutes 42 secondes
- **Parcelles identifiées** : 234 (forêt entière)
- **Parcelles sélectionnées** : 4 (données utilisateur)
- **Correspondance données** : 98%
- **Couches créées** : 3 (principale, mise en valeur, sélectionnées)
- **Cartes générées** : 5
- **Validations** : 100% réussies
- **Conformité** : 100% ONF 2024
- **Score qualité** : 96/100

### Actions Utilisateur
- **1 demande complexe avec données spécifiques**
- **0 intervention manuelle**
- **100% automatisé**

## Avantages du Système Avancé

### Pour le Technicien
- ✅ Gain de temps : 4h de travail → 3min42
- ✅ Correspondance automatique des données : 98% de précision
- ✅ Mise en valeur intelligente : Contexte + sélection
- ✅ Couches multiples : Pour être sûr de bien faire
- ✅ Conformité garantie : Norme ONF respectée
- ✅ Qualité professionnelle : Résolution 300 DPI
- ✅ Reproductibilité : Template standardisé

### Pour l'Organisation
- ✅ Standardisation : Tous les PSG suivent le même format
- ✅ Traçabilité : Logs et rapports complets
- ✅ Collaboration : Espaces de travail partagés
- ✅ Sauvegarde : Sessions et projets sauvegardés
- ✅ Intégration officielle : Sources ONF, IGN, GEOFONCIER
- ✅ Validation : Correspondance données/parcelles vérifiée

### Pour le Client
- ✅ Rapidité : Délai de livraison réduit
- ✅ Qualité : Cartes professionnelles avec mise en valeur
- ✅ Flexibilité : Export multi-format
- ✅ Documentation : Rapports détaillés
- ✅ Précision : Données utilisateur correspond aux données officielles

## Capacité d'Adaptation à des Milliers de Scénarios

Ce système peut s'adapter à une infinité de scénarios différents :

### Scénarios Possibles
1. **PSG avec données spécifiques** (comme ci-dessus)
2. **Carte d'une seule parcelle** avec toutes les analyses
3. **Carte de plusieurs forêts** comparées
4. **Carte temporelle** (évolution sur 10 ans)
5. **Carte de risque** (feu, maladie, tempête)
6. **Carte d'accessibilité** (routes, chemins, zones inaccessibles)
7. **Carte de biodiversité** (espèces protégées, habitats)
8. **Carte de production** (bois, résineux, feuillus)
9. **Carte de gestion** (coupes, plantations, entretien)
10. **Carte de propriété** (privé, public, mixte)

### Flexibilité du Système
- **Task Decomposer** : Planifie automatiquement les étapes selon la demande
- **Forest Document Retriever** : Récupère n'importe quel document d'aménagement
- **Parcel Identification Service** : Identifie les parcelles via n'importe quel flux de cartes
- **Data Parcel Matcher** : Fait correspondre n'importe quelles données avec les parcelles
- **Selective Parcel Extractor** : Extrait selon n'importe quels critères
- **Symbology Applier** : Applique n'importe quelle symbologie
- **Layout Creator** : Crée n'importe quelle mise en page

## Conclusion

Ce scénario avancé démontre la capacité du système à :
1. **Comprendre** une demande complexe avec données spécifiques
2. **Récupérer** automatiquement les documents officiels
3. **Identifier** les parcelles via des flux de cartes
4. **Correspondre** les données utilisateur avec les parcelles (98% de précision)
5. **Extraire** sélectivement les parcelles avec mise en valeur
6. **Créer** des couches multiples pour être sûr de bien faire
7. **Appliquer** une symbologie adaptée
8. **Valider** la qualité et la conformité
9. **Générer** des outputs professionnels
10. **Documenter** l'ensemble du processus

Le système transforme une tâche qui prendrait normalement **4h** en une opération de **3min42**, avec une qualité et une conformité garanties, et peut s'adapter à **des milliers de scénarios différents**.
