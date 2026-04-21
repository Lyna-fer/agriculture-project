# 📋 SPÉCIFICATIONS FONCTIONNELLES ET NON-FONCTIONNELLES
## PFE - Système Expert d'Optimisation des Parcelles Agricoles (Landing Map)

---

## 📖 TABLE DES MATIÈRES
1. [Besoins Fonctionnels](#besoins-fonctionnels)
2. [Besoins Non-Fonctionnels](#besoins-non-fonctionnels)
3. [Architecture Technique](#architecture-technique)
4. [Modèles de Données](#modèles-de-données)

---

## BESOINS FONCTIONNELS

### **A. Gestion Cartographique et Spatiale (SIG)**

#### A.1 Délimitation des Parcelles
**Description:** L'utilisateur peut dessiner un polygone sur une carte interactive pour délimiter sa parcelle agricole.

- **Entrée:** Clic sur la carte pour tracer les sommets du polygone
- **Traitement:** 
  - Validation géométrique (au minimum 3 points)
  - Calcul automatique de la superficie en m² et hectares
- **Sortie:** Affichage du polygone en temps réel avec aperçu de la surface
- **Technologie:** Leaflet.js + React composant DrawPanel.jsx
- **Cas d'usage:** Agriculteur localise sa parcelle sur le terrain ou via satellite
- **Validation:** Géométrie simple (pas de trous ni auto-intersections)

#### A.2 Génération de Points d'Échantillonnage
**Description:** Le système génère automatiquement des points GPS optimisés pour le prélèvement de sol.

- **Entrée:** Polygone de la parcelle dessiné par l'utilisateur
- **Algorithme:** 
  - Stratégie d'échantillonnage : **Grille régulière** ou **Aléatoire stratifiée** (à confirmer)
  - Densité : 1 point par hectare (configurable)
  - Distribution : points générés à l'intérieur du polygone uniquement
- **Sortie:** 
  - Liste de coordonnées GPS (latitude, longitude)
  - Affichage des points sur la carte
  - Compteur du nombre de points générés
- **Technologie:** Backend Python (sampling.py) + Leaflet.js
- **Validation:** Points doivent être intra-parcellaires (buffer de sécurité : 5m)

#### A.3 Exportation Géospatiale (Format KML)
**Description:** L'utilisateur télécharge les points d'échantillonnage en format KML pour utilisation sur le terrain.

- **Entrée:** Points d'échantillonnage générés
- **Format de sortie:** KML 2.2 (compatible Google Earth, GPS mobiles)
- **Contenu KML:**
  - Points d'échantillonnage avec numéros (Point_1, Point_2, etc.)
  - Limite de la parcelle (polygone)
  - Coordonnées en WGS84 (EPSG:4326)
  - Métadonnées : date, nom de la culture, superficie
- **Technologie:** Backend Python (kml_export.py)
- **Validation:** Fichier KML doit être ouvert dans Google Earth sans erreur
- **Cas d'usage:** Agriculteur utilise son smartphone avec Google Earth pour naviguer vers les points sur le terrain

---

### **B. Analyse Satellitaire (Mode Économique / Rapide)**

#### B.1 Extraction de Données Environnementales
**Description:** Le système récupère les données historiques et actuelles de la parcelle via Google Earth Engine.

- **Entrée:** Polygone de la parcelle
- **Données extraites:**
  | Paramètre | Source | Unité | Fréquence |
  |-----------|--------|-------|-----------|
  | Température moyenne annuelle | MODIS (NASA) | °C | Annuelle |
  | Évapotranspiration | MODIS | mm | Mensuelle |
  | Pente (Élévation) | SRTM/DEM | % | Statique |
  | Indice de Salinité (NDVI, NDBI) | Sentinel-2 | Score 0-100 | Saisonnière |
  | Texture du sol estimée | AlphaEarth/SoilGrids | Classe texturale | Statique |
  | NDVI (Indice de Verdure) | Sentinel-2 | -1 à 1 | Mensuelle |
  
- **Technologie:** Google Earth Engine API + Backend Python
- **Latence:** < 10 secondes pour extraction complète
- **Validation:** Vérifier les valeurs dans les plages réalistes

#### B.2 Évaluation Instantanée de Viabilité
**Description:** Première évaluation sans prélèvement laboratoire basée sur les données satellitaires.

- **Entrées:**
  - Culture sélectionnée par l'utilisateur
  - Données environnementales (B.1)
  
- **Logique d'évaluation:**
  ```
  ALERTE CRITIQUE si :
    - Température < T_min de la culture ou > T_max
    - Pente > 30%
    - NDVI très faible (parcelle peu productive)
    
  AVERTISSEMENT si :
    - Salinité estimée élevée
    - Évapotranspiration très faible
  ```

- **Sortie:** 
  - Verdict : "✅ Viabilité élevée" / "⚠️ Risques détectés" / "❌ Non recommandée"
  - Score préliminaire : 0-100%
  - Explications des problèmes détectés
  
- **Technologie:** Frontend React (SoilDiagnostic.jsx)
- **Cas d'usage:** Agriculteur fait un premier diagnostic rapide avant investissement en analyses

---

### **C. Gestion des Analyses de Laboratoire (Mode Premium)**

#### C.1 Génération d'Ordonnance d'Analyse de Sol
**Description:** Le système génère une demande standardisée pour l'analyse physico-chimique en laboratoire.

- **Entrée:** Points d'échantillonnage générés + culture choisie
- **Contenus de l'ordonnance:**
  - Paramètres obligatoires :
    - **pH** (Potentiel Hydrogène)
    - **CE** (Conductivité Électrique - salinité) en dS/m
    - **NPK** (Azote, Phosphore, Potassium) en mg/kg
    - **Calcaire Actif (CaCO₃)** en %
    - **Matière Organique (MO)** en %
    - **Texture du sol** (granulométrie : sable, limon, argile en %)
  - Métadonnées :
    - Date de prélèvement
    - Coordonnées GPS des points
    - Nom et contact du demandeur
    - Culture prévue
    - Historique des analyses (si disponible)

- **Format d'exportation:** 
  - PDF imprimable (rapport normalisé)
  - Fichier CSV pour transmission au laboratoire
  
- **Technologie:** Backend Python (génération) + Frontend React (interface)
- **Standards:** Norme ISO 11265 (méthodes d'analyse de sol)
- **Cas d'usage:** Agriculteur imprime l'ordonnance et envoie les échantillons au laboratoire

#### C.2 Formulaire de Saisie des Résultats Laboratoire
**Description:** Interface pour introduire les résultats physico-chimiques retournés par le laboratoire.

- **Interface Web:**
  - Formulaire structuré avec champs pour chaque paramètre
  - Validation des plages de saisie (ex: pH entre 3 et 10)
  - Upload de fichier (photo rapport laboratoire ou CSV)
  
- **Données à saisir:**
  ```
  Pour CHAQUE point d'échantillonnage:
    - pH (unité : 0-14)
    - CE (unité : dS/m)
    - N (unité : mg/kg ou %)
    - P (unité : mg/kg ou %)
    - K (unité : mg/kg ou %)
    - Calcaire Actif (unité : %)
    - Matière Organique (unité : %)
    - Texture (sélecteur : sable %, limon %, argile %)
  ```

- **Sauvegarde:**
  - Stockage en base de données (PostgreSQL)
  - Horodatage et traçabilité (qui a saisi, quand)
  - Historique : conserver tous les prélèvements antérieurs
  
- **Technologie:** Frontend React + Backend FastAPI + PostgreSQL/Neon
- **Validation:**
  - Plages acceptables par paramètre
  - Cohérence (la somme texture = 100%)
  - Alerte si valeurs aberrantes
  
- **Cas d'usage:** Agriculteur reçoit rapport laboratoire et saisit les résultats dans l'app

#### C.3 Archivage et Historique
**Description:** Conserver toutes les analyses réalisées pour suivi temporel.

- **Données archivées:**
  - Date de l'analyse
  - Résultats complets (pH, CE, NPK, etc.)
  - Parcelle associée
  - Recommandations générées à partir de ces résultats
  
- **Requêtes possibles:**
  - Comparer deux analyses successives
  - Détecter tendances (sol devient plus salin ? MO diminue ?)
  - Évaluer impact des recommandations passées
  
- **Durée de conservation:** 5 ans minimum (obligation légale France/UE)

---

### **D. Système Expert et Recommandations Agronomiques**

#### D.1 Évaluation Multi-Critères (Score de Compatibilité)
**Description:** Algorithme pondéré calculant la compatibilité sol-culture (0-100%).

- **Critères évalués:**
  
  | Critère | Poids | Source | Formule |
  |---------|-------|--------|---------|
  | **Matière Organique (OM)** | 20% | Labo/Satellite | min(OM / OM_opt, 100%) |
  | **Calcaire Actif** | 20% | Labo | 100 - abs(CaCO₃ - CaCO₃_opt) * facteur |
  | **pH** | 15% | Labo | Gaussienne centrée sur pH_opt |
  | **Texture (Granulométrie)** | 20% | Labo | Distance classe_texture vs texture_opt |
  | **Salinité (CE)** | 15% | Labo | 100 - max(0, CE - CE_max) * facteur |
  | **Pente/Topographie** | 10% | Satellite | 100 si pente < 15%, 0 si > 30% |

- **Seuils FAO/ITAF par culture (exemple):**
  
  **TOMATE:**
  - OM minimum : 2%
  - pH optimal : 6.0 - 6.8
  - CE maximum : 2.5 dS/m (salinité)
  - Calcaire Actif maximum : 10%
  - Texture préférée : Limon-Argileux
  
  **BLÉ DUR:**
  - OM minimum : 1.5%
  - pH optimal : 6.5 - 8.0
  - CE maximum : 3.5 dS/m
  - Calcaire Actif maximum : 20%
  - Texture préférée : Limon-Argileux à Argilo-Limoneux
  
  **OLIVIERS:**
  - OM minimum : 1%
  - pH optimal : 6.0 - 8.5
  - CE maximum : 4 dS/m
  - Calcaire Actif maximum : 30%
  - Texture préférée : Bien drainé (graviers OK)

- **Sortie Finale:**
  ```
  Score Global = 
    0.20 × Score_OM + 
    0.20 × Score_Calcaire + 
    0.15 × Score_pH + 
    0.20 × Score_Texture + 
    0.15 × Score_CE + 
    0.10 × Score_Pente
  ```
  
  **Interprétation:**
  - 80-100% : ✅ Excellent
  - 60-79% : ✓ Bon
  - 40-59% : ⚠️ Acceptable avec corrections
  - 0-39% : ❌ Déconseillé

- **Technologie:** Logique implémentée en Frontend (SoilDiagnostic.jsx) et Backend (scoring algorithms)
- **Validation:** Comparer avec recommandations manuelles d'agronomes
- **Cas d'usage:** Score global qui guide l'agriculteur sur la viabilité du projet

---

#### D.2 Calcul des Besoins en Fertilisation (NPK)
**Description:** Déterminer les doses exactes d'engrais à appliquer.

- **Entrées:**
  - N, P, K mesurés en labo (mg/kg)
  - Rendement-cible de la culture (kg/ha)
  - Culture choisie
  - Superficie de la parcelle (ha)

- **Formule générale (NFU France):**
  ```
  BESOIN_N (kg/ha) = (Consommation_culture - N_assimilable_sol) + Minéralisation
  
  Où:
    - Consommation = rendement-cible × coefficient_culture
    - N_assimilable = N_labo × 1.5 (conversion)
    - Minéralisation = OM(%) × 20 kg/ha/an (estimation)
  
  DOSE_ENGRAIS_N (kg) = BESOIN_N × Superficie / 100 × (perte_lessivage)
  ```

- **Sorties par nutriment:**
  - **Azote (N):** kg à appliquer, fractionnement proposé (3-4 apports)
  - **Phosphore (P):** kg à appliquer, apport unique en automne
  - **Potassium (K):** kg à appliquer, 1-2 apports

- **Recommandations d'engrais commerciaux:**
  - Suggestion de marques/formulations (ex: NPK 15-15-15)
  - Coûts estimés (source prix région)
  - Calendrier d'application (jours avant plantation)

- **Technologie:** Backend Python + formules NPK
- **Standards:** Méthode bilan COMIFER (France) / FAO
- **Cas d'usage:** Agriculteur reçoit facture précise du fertilisant nécessaire

---

#### D.3 Alertes de Risques Environnementaux
**Description:** Détecter et signaler les risques critiques pour la culture.

##### **Alerte 1 : Chlorose Ferrique**
- **Déclencheur:** Calcaire Actif > seuil culture
- **Cause:** pH trop élevé bloque l'assimilation du fer par la plante
- **Seuil exemple (Tomate):** CaCO₃ > 10%
- **Actions correctives proposées:**
  - Apport de chélates de fer
  - Sulphate de fer si possible
  - Apport acide faible (soufre moulu)
- **Affichage:** 🚨 RISQUE ÉLEVÉ - Chlorose ferrique possible

##### **Alerte 2 : Risque Salinité**
- **Déclencheur:** CE > seuil tolérance culture
- **Source:** Sels (Na⁺, Cl⁻, SO₄²⁻) trop concentrés
- **Seuil exemple (Tomate):** CE > 2.5 dS/m
- **Actions correctives:**
  - Drainage amélioré
  - Lessivage du sol (irrigation abondante)
  - Choix variétés plus tolérantes
- **Affichage:** ⚠️ ATTENTION - Salinité élevée

##### **Alerte 3 : Risque Vents Violents** ⚡ **À CLARIFIER**
- **Déclencheur:** 
  - Vitesse vent moyen > 30 km/h en saison critique
  - **SOURCE DONNÉES :** ❓ Où provient le vent ? 
    - Option A: Google Earth Engine n'a pas de données vent = besoin API externe (NOAA, Meteoblue)
    - Option B: Données climatiques régionales (Algérie = vent Sirocco saisonnier)
    - **RECOMMANDATION:** Utiliser **données historiques régionales** + API météo (OpenWeatherMap)
    
- **Stades critiques (exemple Blé):**
  - Floraison : très sensible aux vents secs (avortement floral)
  - Remplissage grain : dégâts physiques (verse)
  
- **Actions correctives:**
  - Haies/brise-vent à implanter
  - Variétés très robustes
  - Décaler date de semis
  
- **Affichage:** ⚠️ ATTENTION - Risque verse (vents violents en phase critique)

##### **Alerte 4 : Texture Inadéquate**
- **Déclencheur:** Texture sol très différente de l'optimum
- **Exemple:** 80% argile pour une culture préférant limon-sableux
- **Actions correctives:**
  - Amendements (sable, compost) sur longue période
  - Drainage (sol trop compact)
  
##### **Alerte 5 : pH Critique**
- **Déclencheur:** pH < 5.5 ou pH > 8.5 (selon culture)
- **Cause:** Acidité ou alcalinité trop forte
- **Actions correctives:**
  - Chaulage (pH bas) : ajout CaCO₃
  - Acidification (pH haut) : soufre moulu, tourbe
  - Patience : correction prend 1-2 ans

- **Technologie:** Backend + Frontend (notifications toast/modal)
- **Affichage:** Badges de couleur + explications texte
- **Cas d'usage:** Alerte affichée en haut de l'interface, empêche validation si risque critique

---

## BESOINS NON-FONCTIONNELS

### **E. Gestion d'Authentification et Multi-Utilisateurs**

#### E.1 Authentification Sécurisée
- **Mécanisme:** OAuth2 + JWT (JSON Web Tokens)
- **Implémentation:** FastAPI `OAuth2PasswordBearer`
- **Durée token:** 
  - Access token : 15 minutes
  - Refresh token : 7 jours
- **Hachage mots de passe:** bcrypt (algo industrie)
- **HTTPS obligatoire:** Tous les transferts de token/credentials

#### E.2 Profils et Rôles Utilisateurs
- **Agriculteur (Rôle: `farmer`):**
  - Peut créer/modifier ses propres parcelles
  - Peut générer points d'échantillonnage
  - Peut télécharger KML
  - Peut saisir résultats labo
  - **Accès:** Son propre espace de travail
  
- **Agronome (Rôle: `agronomist`):**
  - Lecture-seule des parcelles agriculteurs (si consentement)
  - Peut valider/modifier recommandations
  - Accès panel statistiques globales
  - **Accès:** Multi-parcelles sur autorisation
  
- **Administrateur (Rôle: `admin`):**
  - Gestion utilisateurs
  - Configuration seuils cultures
  - Audit logs complets
  - **Accès:** Tous les systèmes

#### E.3 Contrôle d'Accès Basé Rôles (RBAC)
- Vérification rôle sur chaque endpoint protégé
- Déclaration explicite sur chaque fonction : `@requires_role('farmer')`
- Réponse 403 Forbidden si accès refusé

---

### **F. Persistance et Base de Données**

#### F.1 Modèle Relationnel PostgreSQL
**Tables principales:**

```
USERS
├── id (PK)
├── username (UNIQUE)
├── email (UNIQUE)
├── password_hash
├── role (farmer/agronomist/admin)
├── created_at
└── updated_at

PARCELS
├── id (PK)
├── user_id (FK → USERS)
├── nom_parcelle
├── geom (PostGIS Polygon WGS84)
├── superficie_ha
├── culture_principale
├── created_at
└── updated_at

SAMPLING_POINTS
├── id (PK)
├── parcel_id (FK → PARCELS)
├── point_number
├── latitude
├── longitude
├── elevation_m
├── created_at
└── exported_kml_id (FK)

SOIL_ANALYSES
├── id (PK)
├── parcel_id (FK → PARCELS)
├── analysis_date
├── laboratoire_name
├── results_json (flexible schema)
├── point_id (FK optional - si analyse par point)
├── created_at
└── updated_at

ANALYSIS_RESULTS
├── id (PK)
├── soil_analysis_id (FK)
├── parameter (pH/CE/N/P/K/CaCO3/MO/Texture)
├── value (FLOAT)
├── unit (dS/m / % / mg/kg / etc)
└── validated_at

RECOMMENDATIONS
├── id (PK)
├── parcel_id (FK → PARCELS)
├── culture_name
├── analysis_id (FK → SOIL_ANALYSES)
├── compatibility_score (0-100)
├── generated_at
├── npk_fertilizer_n (kg/ha)
├── npk_fertilizer_p (kg/ha)
├── npk_fertilizer_k (kg/ha)
└── alerts (JSON array)

ALERTS_LOG
├── id (PK)
├── recommendation_id (FK)
├── alert_type (chlorose/salinity/wind/etc)
├── severity (LOW/MEDIUM/HIGH)
└── timestamp
```

#### F.2 Requêtes GIS (PostGIS)
- Requêtes géospatiales optimisées :
  ```sql
  -- Exemple : Points d'échantillonnage dans un polygone
  SELECT * FROM sampling_points 
  WHERE ST_Contains(
    (SELECT geom FROM parcels WHERE id = ?), 
    ST_Point(longitude, latitude)
  );
  ```
- Index spatiaux : `GIST` ou `BRIN` sur colonnes géométriques
- Performance : < 500ms pour requête sur 10k points

#### F.3 Sauvegardes et Récupération
- **Sauvegarde:** Automatique quotidienne (Neon PostgreSQL gère)
- **Récupération:** Point-in-time recovery (7 jours de logs)
- **Chiffrement:** Au repos (PostgreSQL native encryption)

---

### **G. Fiabilité et Rigueur Scientifique**

#### G.1 Normes et Références Agronomiques
- **Seuils pH/CE/NPK:** FAO Guidelines
- **Calcaire Actif (zone méditerranéenne):** Références ITAF/INRA Algérie
- **Texture du sol:** Classification USDA
- **Salinité:** Normes ISO 11265
- **Documentation:** Toutes les formules doivent être sourcées (traçabilité)

#### G.2 Validation des Données
- **Entrées utilisateur:**
  - Polygone valide (> 3 points, pas d'auto-intersection)
  - Coordonnées GPS en WGS84
  - Plages acceptables (pH 3-10, CE 0-10 dS/m, etc.)
  
- **Données GEE:**
  - Alerter si donnée manquante/outdated (> 1 an)
  - Valeurs aberrantes : log et notification
  
- **Résultats labo:**
  - Cohérence : texture sable+limon+argile = 100%
  - Ratio P/K cohérent avec NPK
  - Comparaison historique : écart > 100% = alerte

#### G.3 Traçabilité Complète
- **Audit logs :**
  - Qui a créé / modifié / validé quelle parcelle
  - Horodatage UTC précis
  - Source des données (satellite / labo / manuel)
  - Version des formules/seuils utilisés
  
- **Export rapport complet:**
  - PDF détaillé avec toutes les données + métadonnées
  - Références utilisées (liens FAO/INRA)

---

### **H. Ergonomie et Utilisabilité**

#### H.1 Responsive Design
- **Breakpoints CSS:**
  - Mobile: 320px - 768px
  - Tablet: 768px - 1024px
  - Desktop: 1024px+
  
- **Composants React adaptés:**
  - Maps : zoom/pan au doigt sur mobile
  - Formulaires : champs larges, touches grandes
  - Modales : scrollable sur petit écran
  
#### H.2 Accessibilité (A11y)
- **WCAG 2.1 AA minimum**
  - Contraste texte 4.5:1
  - Boutons navigables au clavier (Tab)
  - Aria-labels sur icônes
  - Support lecteur d'écran
  
#### H.3 Offline-First / Progressive Web App
- Service Worker pour cache des cartes
- Possibilité dessin hors-ligne, sync après reconnexion
- Installation sur écran d'accueil mobile

---

### **I. Performance et Temps de Réponse**

#### I.1 Latence Acceptables
| Action | Délai Max | Technologie |
|--------|-----------|-------------|
| Chargement carte | 2s | Tile layer Leaflet |
| Extraction GEE | 10s | Async API call |
| Calcul scoring | 1s | Backend synchrone |
| Saisie formulaire | 200ms | Client-side validation |
| Génération KML | 3s | Python backend |
| Affichage 1000 points | < 5s | Clustering Leaflet |

#### I.2 Optimisations
- **Frontend:**
  - Code-splitting Vite
  - Lazy load cartes/images
  - Memoization React (`useMemo`, `useCallback`)
  
- **Backend:**
  - Connection pooling PostgreSQL
  - Cache Redis pour requêtes GEE fréquentes
  - Pagination pour requêtes volumineuses
  
- **GEE:**
  - Requête zoomée sur bounding box (pas France entière)
  - Caching des assets publics (DEM, Sentinel-2 indices)

#### I.3 Monitoring et Logs
- **Stack APM:** Sentry (erreurs) + DataDog (perf)
- **Logs applicatifs:** Structure JSON (date, level, user_id, action, duration)
- **Alertes:** Si endpoint > 5s = alert admin

---

### **J. Sécurité et Confidentialité**

#### J.1 Gestion des Variables d'Environnement
```
DATABASE_URL              # Neon PostgreSQL
GOOGLE_EARTH_ENGINE_KEY   # API GEE
JWT_SECRET_KEY            # Clé signature tokens
API_BASE_URL              # Origin backend
VITE_API_URL              # Origin frontend
```
- **Stockage:** `.env` (ignoré Git) + variables Github Actions
- **Rotation:** Clés renouvelées semestriellement
- **Audit:** Log accès GEE API (limiter quota)

#### J.2 Confidentialité des Données Géospatiales
- **Coordonnées GPS :**
  - Chiffrage en base de données
  - Pas d'exposition dans logs
  - Partage data agriculteur ↔ agronome : consentement explicite
  
- **RGPD/Loi Agritourisme:**
  - Droit à l'oubli : suppression physique des parcelles
  - Portabilité données : export JSON/CSV
  - Durée rétention : 7 ans (obligations agricoles)

#### J.3 Authentification et Autorisation
- **HTTPS/TLS 1.3 minimum** pour toute transmission
- **CORS stricte:** Accepter requêtes depuis origin frontend uniquement
- **Rate-limiting:** 100 requêtes/min par IP
- **Protection CSRF:** Token SameSite=Strict

#### J.4 Injection SQL / XSS / CSRF
- **ORM SQLAlchemy:** Prévient injection SQL
- **Sanitization inputs:** Validation schema Pydantic + regex
- **Escaping outputs:** React échappe HTML par défaut
- **Headers de sécurité:**
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Content-Security-Policy: ...
  Strict-Transport-Security: max-age=31536000
  ```

---

### **K. Interopérabilité**

#### K.1 Architecture Layers
```
┌─────────────────────────────────┐
│   Frontend (React Vite)         │
│   Components: DrawPanel, Map    │
└────────────────┬────────────────┘
                 │ REST API (JSON)
┌────────────────▼────────────────┐
│   Backend (FastAPI Python)      │
│   Routes: /api/parcels, /api/   │
│   sampling, /api/recommendations│
└────────────────┬────────────────┘
                 │ SQL
     ┌───────────┼──────────────┐
     │           │              │
     ▼           ▼              ▼
  PostgreSQL   GEE API   Weather API
  (Neon)      (Google)   (OpenWeather)
```

#### K.2 Formats d'Échange Standards
- **KML 2.2:** Géométries + métadonnées
- **GeoJSON:** Polygones <-> API
- **CSV:** Import/export analyses
- **PDF:** Rapports téléchargeables
- **API REST:** Content-Type: application/json

#### K.3 Documentation API
- **OpenAPI/Swagger:** Auto-documentée via FastAPI
- **Endpoint examples:** Curl, Python, JS
- **Error codes:** 400 Bad Request, 401 Unauthorized, 403 Forbidden, 500 Server Error

---

## ARCHITECTURE TECHNIQUE

```
landing-map-part1-logic2/
├── Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── DrawPanel.jsx         ← Dessin parcelle
│   │   │   │   ├── MapView.jsx           ← Leaflet + GEE overlay
│   │   │   │   ├── SoilDiagnostic.jsx    ← Scoring + recommandations
│   │   │   │   ├── ResultsPanel.jsx      ← Affichage résultats
│   │   │   │   └── Toast.jsx             ← Alertes
│   │   │   └── landing/
│   │   │       └── ...
│   │   ├── services/
│   │   │   └── samplingLogic.js          ← Logique points
│   │   ├── lib/
│   │   │   └── samplingEngine.js         ← Algo échantillonnage
│   │   └── data/
│   │       └── cropData.js               ← Seuils cultures
│   └── package.json
│
└── Backend (FastAPI + Python)
    ├── Backend/
    │   ├── main.py                       ← Routes FastAPI
    │   ├── constants.py                  ← Seuils agronomiques
    │   ├── models.py                     ← ORM SQLAlchemy
    │   ├── services/
    │   │   ├── sampling.py               ← Génération points
    │   │   ├── kml_export.py             ← Export KML
    │   │   └── api.js                    ← (Déplacer en JS?)
    │   └── utils/
    │       └── geometry.py               ← Validations GIS
    ├── requirements.txt
    ├── .env (ignored)
    └── tests/
```

---

## MODÈLES DE DONNÉES

### **Parcel (Parcelle)**
```python
class Parcel(Base):
    __tablename__ = "parcels"
    
    id: int
    user_id: int (FK)
    nom: str
    geom: Polygon (PostGIS WGS84)
    superficie_ha: float
    culture_principale: str
    created_at: datetime
    updated_at: datetime
    
    # Relations
    sampling_points: List[SamplingPoint]
    soil_analyses: List[SoilAnalysis]
    recommendations: List[Recommendation]
```

### **SamplingPoint (Point d'Échantillonnage)**
```python
class SamplingPoint(Base):
    __tablename__ = "sampling_points"
    
    id: int
    parcel_id: int (FK)
    point_number: int
    latitude: float
    longitude: float
    elevation_m: float (optional)
    exported_kml: bool
    created_at: datetime
```

### **SoilAnalysis (Analyse de Sol)**
```python
class SoilAnalysis(Base):
    __tablename__ = "soil_analyses"
    
    id: int
    parcel_id: int (FK)
    analysis_date: date
    lab_name: str (optional)
    results: JSON (flexible)
    created_at: datetime
    
    # Results structure:
    {
        "ph": 6.8,
        "ce": 1.2,  # dS/m
        "n": 45,    # mg/kg
        "p": 20,
        "k": 180,
        "caco3": 8.5,  # %
        "om": 2.5,     # %
        "texture": {
            "sable": 30,
            "limon": 50,
            "argile": 20
        }
    }
```

### **Recommendation (Recommandation)**
```python
class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id: int
    parcel_id: int (FK)
    analysis_id: int (FK, optional)
    culture: str
    compatibility_score: int (0-100)
    
    npk_n: float  # kg/ha
    npk_p: float
    npk_k: float
    
    alerts: JSON (list)
    # [
    #   {"type": "chlorose", "severity": "HIGH", "action": "..."},
    #   {"type": "salinity", "severity": "MEDIUM", "action": "..."},
    #   ...
    # ]
    
    generated_at: datetime
```

---

## PRIORITÉS DE DÉVELOPPEMENT

### **Phase 1 (MVP)** - À court terme
- ✅ Délimitation parcelle + points d'échantillonnage
- ✅ Export KML
- ⚠️ Extraction GEE basique (température, pente)
- ✅ Scoring multi-critères simple
- ⚠️ Saisie résultats labo (formulaire basique)

### **Phase 2** - À moyen terme
- ℹ️ Calcul NPK complet
- ℹ️ Alertes détaillées (chlorose, salinité, etc.)
- ℹ️ Historique analyses
- ℹ️ Authentification multi-utilisateurs

### **Phase 3** - À long terme
- ℹ️ Intégration API météo (données vent)
- ℹ️ Recommandations d'engrais commerciaux (base prix)
- ℹ️ Panel analytics pour agronomes
- ℹ️ Mobile app native (React Native)

---

## GLOSSAIRE

| Terme | Définition |
|-------|-----------|
| **GIS/SIG** | Système d'Information Géographique |
| **KML** | Keyhole Markup Language (format Google Earth) |
| **GEE** | Google Earth Engine |
| **CE** | Conductivité Électrique (salinité) |
| **NPK** | Azote-Phosphore-Potassium |
| **CaCO₃** | Calcaire actif |
| **OM** | Matière organique |
| **pH** | Potentiel hydrogène |
| **NDVI** | Normalized Difference Vegetation Index |
| **WGS84** | Système de projection GPS (EPSG:4326) |
| **FAO** | Food and Agriculture Organization (ONU) |
| **ITAF** | Institut Technique de l'Arboriculture Fruitière |
| **INRA** | Institut National Recherche Agronomique |
| **PostGIS** | Extension PostgreSQL géospatiale |

---

**Document Version:** 1.0  
**Dernière mise à jour:** 20 Avril 2026  
**Auteur:** Équipe Développement PFE  
**Statut:** ✅ En cours de validation
