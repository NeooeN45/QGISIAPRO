# 🎯 Questionnaire stratégique GeoSylva V2

> **Vision confirmée** : l'utilisateur écrit une demande en langage naturel dans le chat → l'IA décide, planifie, exécute, produit la carte et les exports automatiquement.
>
> Ce doc fige les décisions produit. Réponds case par case. Chaque choix oriente 6 mois de dev.

---

## A. Identité & positionnement

### A1. Nom du produit final
- [ ] GeoSylva AI (actuel)
- [ ] Autre : ____________________

### A2. Une phrase (positionnement) — coche ou reformule
- [ ] "L'assistant SIG qui fait le travail à ta place."
- [ ] "Demande, l'IA cartographie."
- [ ] "Le premier agent géospatial autonome."
- [ ] Autre : ____________________

### A3. Slogan marketing court (6-8 mots)
Réponse : ____________________

---

## B. Le cœur agentique (prio absolue)

### B1. Niveau d'autonomie par défaut
- [ ] **Autopilot** : l'IA fait tout sans demander, notifie à la fin
- [ ] **Plan + confirm** : l'IA propose un plan, attend 1 clic, exécute tout
- [ ] **Step-by-step** : l'IA demande avant chaque étape

> Recommandation pro : **Plan + confirm** par défaut, **Autopilot** activable en settings.

### B2. Ce que l'IA peut faire SANS confirmation
Coche ce qui est autorisé en autopilot :
- [ ] Charger des couches (WMS/WFS, fichiers locaux)
- [ ] Lancer des traitements (reprojection, buffer, clip, raster calc)
- [ ] Créer de nouvelles couches dérivées
- [ ] Modifier les styles / symbologie
- [ ] Exporter en PDF / PNG / GeoPackage
- [ ] Appeler des APIs externes (IGN, cadastre, Copernicus)
- [ ] Supprimer / remplacer des couches existantes ❌ (reco: JAMAIS)
- [ ] Écrire sur disque hors dossier projet ❌ (reco: JAMAIS)

### B3. Formats d'export automatique à supporter
- [ ] PDF carte (mise en page auto, titre, légende, échelle, flèche nord)
- [ ] PNG haute résolution
- [ ] GeoTIFF
- [ ] GeoPackage
- [ ] Shapefile
- [ ] GeoJSON
- [ ] KML/KMZ (Google Earth)
- [ ] CSV (statistiques)
- [ ] Excel (rapport tabulaire)
- [ ] Word/DOCX (rapport narratif)
- [ ] Markdown / HTML
- [ ] Atlas QGIS (séries de cartes)

### B4. Langues supportées dans le chat
- [x] Français (priorité absolue)
- [ ] Anglais
- [ ] Espagnol
- [ ] Allemand
- [ ] Autre : ____________________

### B5. Input vocal ?
- [ ] Oui, Whisper local (offline, gratuit)
- [ ] Oui, Whisper cloud (rapide, payant)
- [ ] Non, pas prioritaire
- [ ] Plus tard (Sprint 10+)

---

## C. Cible commerciale

### C1. Persona #1 à conquérir (marché le plus chaud)
Classe de 1 (prioritaire) à 7 :
- ___ Forestier privé / coopérative
- ___ Collectivité / mairie
- ___ Bureau d'études environnement
- ___ Agriculteur / viticulteur
- ___ Assureur / risque
- ___ Administration / gendarmerie
- ___ Pro SIG indépendant / consultant

### C2. Tu vends comment ?
- [ ] B2C plugin QGIS gratuit + pro 19-89€/mois (self-service)
- [ ] B2B direct, devis, démo live
- [ ] Les deux (freemium + enterprise)
- [ ] Licence groupe (coopératives, ordres pros)

### C3. Géographie cible année 1
- [ ] France uniquement
- [ ] France + Belgique + Suisse
- [ ] Europe
- [ ] Monde (anglais d'abord)

---

## D. Business model

### D1. Open source vs propriétaire
- [ ] Tout open source (MIT) — gain communauté, perte revenus
- [ ] Core open source + modules Pro fermés (reco)
- [ ] Tout propriétaire — max revenus, zéro effet réseau

### D2. Budget mensuel cloud IA (tests + zéro clients)
- [ ] < 50€ (Ollama local obligatoire par défaut)
- [ ] 50-200€ (mix local + Gemini Flash gratuit)
- [ ] 200-1000€ (confort, Claude/GPT utilisables)
- [ ] > 1000€ (scale rapide)

### D3. Tarification que tu vises
| Tier | Ton prix | Client cible |
|---|---|---|
| Gratuit | 0€ | ____________________ |
| Starter | ___€/mois | ____________________ |
| Pro | ___€/mois | ____________________ |
| Team | ___€/mois | ____________________ |
| Enterprise | ___€/an | ____________________ |

### D4. Levée de fonds envisagée ?
- [ ] Non, bootstrap
- [ ] Seed 6 mois (100-500k€)
- [ ] Série A quand 10k€/mois MRR
- [ ] Pas de plan défini

---

## E. Intégrations & différenciateurs

### E1. Priorités d'intégration données (classe top 5)
- ___ Cadastre (cadastre.data.gouv.fr + API Carto)
- ___ IGN Géoplateforme (WMS/WMTS) + BD TOPO
- ___ LiDAR HD IGN (MNS/MNT national)
- ___ Sentinel-2 via Copernicus (satellite optique)
- ___ Sentinel-1 (SAR, radar)
- ___ Google Earth Engine
- ___ PLU / Géoportail de l'urbanisme
- ___ RPG (agriculture)
- ___ Hub'Eau / Naïades (qualité eau)
- ___ GBIF / INPN (biodiversité)
- ___ DVF (valeurs foncières)
- ___ Vigicrues / EFFIS (risques)
- ___ OpenStreetMap Overpass
- ___ Météo-France / ERA5
- ___ BRGM (géologie)

### E2. Modules prioritaires (classe top 3)
- ___ **SylvaWatch** (forêts) — ton expertise
- ___ **UrbanGuard** (cadastre + urbanisme)
- ___ **AquaScope** (qualité eau)
- ___ **BioTrack** (biodiversité)
- ___ **RiskSentinel** (risques)
- ___ **AgriLens** (agriculture)
- ___ **CivicData** (collectivités)

### E3. Killer feature qui doit exister au MVP
Une seule réponse :
- [ ] Rapport forestier PDF automatique parfait (Pixstart killer)
- [ ] Détection construction illégale multi-temporelle
- [ ] Qualité eau + alertes automatiques
- [ ] Suivi biodiversité + inventaire assisté
- [ ] Autre : ____________________

---

## F. Technique & contraintes

### F1. Mode offline obligatoire ?
- [ ] Oui, doit marcher sans internet (Ollama + cache)
- [ ] Hybride, dégradé si offline
- [ ] Non, internet toujours requis (plus simple)

### F2. Données sensibles
- [ ] Aucune — tout public
- [ ] Oui — besoin RGPD + chiffrement + on-prem option
- [ ] Secret défense / militaire envisagé

### F3. QGIS obligatoire ?
- [ ] Oui, le produit est un plugin QGIS avant tout
- [ ] Plugin + standalone web, QGIS en option
- [ ] Standalone d'abord, plugin bonus

### F4. Plateformes à supporter
- [x] Windows
- [ ] Linux
- [ ] macOS
- [ ] Mobile (PWA read-only)
- [ ] Tablette (terrain)

---

## G. Différenciation vs Pixstart

### G1. Pourquoi un client choisirait GeoSylva plutôt que Pixstart ?
Réponse libre (3-5 raisons) :
1. ____________________
2. ____________________
3. ____________________
4. ____________________
5. ____________________

### G2. Ce que Pixstart fait mieux et que tu veux matcher
Réponse libre :
____________________

---

## H. Équipe & timeline

### H1. Tu codes seul ou équipe ?
- [ ] Solo
- [ ] Avec 1-2 personnes
- [ ] Recrutement prévu après MVP

### H2. Temps hebdo consacré
- [ ] < 10h (projet side)
- [ ] 10-25h (semi-pro)
- [ ] > 25h (full-time)

### H3. Deadline MVP commercialisable
- [ ] 3 mois (rythme intense)
- [ ] 6 mois (confortable)
- [ ] 12 mois (perfection)

---

## Une fois rempli

Renvoie-moi ce doc rempli (même partiellement). Je produis :
1. **Charte produit V2** (reformule tes choix en contrat figé)
2. **Roadmap ajustée** aux priorités
3. **Premier ticket de dev** aligné sur tes top priorités
