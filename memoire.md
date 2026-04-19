# Mémoire de fin d’études (version de travail)

## Thème
**Système d’aide à la décision agricole pour l’échantillonnage des sols et la recommandation culturale en Algérie**

---

## Résumé
Ce travail présente la conception et la réalisation d’une application web d’aide à la décision agricole, orientée vers le contexte algérien.  
La solution suit un flux en deux phases :  
1. **Guidage d’échantillonnage du sol sur carte** (délimitation de parcelle + plan d’échantillonnage).  
2. **Recommandation culturale** à partir des paramètres du sol, avec validation de faisabilité d’une culture choisie.

L’application cible trois groupes d’étude : **cultures maraîchères**, **cultures céréalières** et **cultures permanentes**.  
Les entrées agronomiques prises en compte incluent : **pH, N, P, K, salinité, température, texture et matière organique**.

---

## Abstract (FR court)
This dissertation presents a web-based agricultural decision-support system for Algerian farming conditions.  
The proposed workflow has two phases: map-based soil sampling guidance, then soil-parameter-based crop recommendation.  
The system handles three study groups (vegetables, cereals, perennial crops) and evaluates both top group recommendations and the feasibility of a user-selected crop with corrective actions.

---

## Introduction générale
L’agriculture moderne nécessite des décisions rapides et fiables, fondées sur des données de terrain. Dans de nombreuses exploitations, le choix des cultures et les pratiques d’échantillonnage des sols restent souvent empiriques, ce qui peut entraîner des rendements faibles, des surcoûts d’intrants et une dégradation progressive de la qualité des sols.

Dans ce contexte, ce mémoire propose une approche numérique intégrée : associer la cartographie de la parcelle, la planification de l’échantillonnage, et la recommandation culturale basée sur des paramètres physico-chimiques du sol.  
L’objectif est d’offrir à l’agriculteur un outil simple, compréhensible et exploitable pour améliorer la qualité de décision.

### Problématique
Comment construire une application web qui :
- guide l’utilisateur dans un **échantillonnage de sol cohérent** sur carte,
- puis recommande les cultures les plus adaptées selon des **indicateurs agronomiques mesurables**,
- tout en permettant de **tester la faisabilité** d’une culture visée avec des actions correctives explicites ?

### Objectifs
- Proposer un flux décisionnel en deux phases (carte puis recommandation).
- Cadrer la recommandation selon 3 groupes culturaux (maraîchères, céréalières, permanentes).
- Fournir des sorties actionnables : score de compatibilité, alertes (acidité/alcalinité/salinité), ajustements recommandés.

---

## Chapitre 1 — État de l’art et contexte
Les systèmes d’aide à la décision agricole (DSS) combinent généralement :
- des données spatiales (parcelles, cartes, images),
- des données d’analyses de sol,
- des règles métier agronomiques,
- une interface utilisateur orientée terrain.

Dans notre cas, l’accent est mis sur la **mise en pratique opérationnelle** : guider l’échantillonnage avant la recommandation. Cette articulation réduit le risque de recommandations basées sur des données mal représentatives de la parcelle.

---

## Chapitre 2 — Analyse des besoins
### Besoins fonctionnels
1. Tracer une parcelle sur carte.  
2. Choisir un groupe d’étude (maraîchères / céréalières / permanentes).  
3. Obtenir un plan d’échantillonnage (nombre de points, profondeur, motif).  
4. Saisir les paramètres du sol (pH, N, P, K, salinité, température, texture, MO).  
5. Recevoir les meilleures cultures pour le groupe sélectionné.  
6. Vérifier une culture choisie par l’utilisateur avec actions correctives.

### Besoins non fonctionnels
- Interface claire et rapide à utiliser.
- Affichage web responsive.
- Explications compréhensibles pour des profils non techniques.

---

## Chapitre 3 — Conception de la solution
### Vue globale
La solution est structurée autour de deux modules logiques :

#### Module A : Échantillonnage cartographique
- Délimitation de la parcelle.
- Génération d’instructions de prélèvement (points/profondeur/motif).

#### Module B : Recommandation culturale
- Lecture des paramètres de sol saisis.
- Évaluation de compatibilité par culture au sein du groupe choisi.
- Production d’un classement de cultures recommandées.
- Vérification ciblée de culture demandée par l’utilisateur.

### Décisions de conception
- **Approche guidée par workflow** : limiter la confusion en séparant clairement les étapes.
- **Approche groupe d’étude** : éviter des recommandations hors contexte de production.
- **Sorties explicatives** : rendre la décision transparente (pas seulement “oui/non”).

---

## Chapitre 4 — Réalisation
### Stack utilisée
- Frontend web avec **React + Vite**.
- Cartographie interactive (Leaflet et extensions associées).

### Réalisation fonctionnelle
- Les sections d’atterrissage (landing) décrivent explicitement le flux en 2 phases.
- Le contenu produit met en évidence les 3 groupes d’étude.
- Le module de recommandation mentionne les 8 critères de sol.
- Le résultat attendu inclut le **top des cultures compatibles** + **faisabilité d’une culture choisie**.

---

## Chapitre 5 — Tests et validation
La validation fonctionnelle se fait par scénarios utilisateur :
1. Sélection parcelle → plan d’échantillonnage généré.
2. Saisie paramètres du sol → recommandations adaptées au groupe.
3. Test d’une culture ciblée → score + alertes + corrections suggérées.

Des vérifications techniques de build sont effectuées pour garantir la stabilité de l’interface.

---

## Chapitre 6 — Résultats et discussion
### Apports
- Clarification du processus décisionnel terrain.
- Réduction du caractère empirique des choix culturaux.
- Meilleure traçabilité de la décision grâce aux explications et alertes.

### Limites
- La qualité de la recommandation dépend de la qualité des analyses de sol.
- L’absence de séries historiques riches peut limiter la précision dans certains cas.

### Perspectives
- Intégration de séries temporelles météo plus fines.
- Ajustement régional des seuils agronomiques.
- Ajout d’un module de suivi post-récolte pour boucler la décision.

---

## Conclusion générale
Ce mémoire montre qu’un système web simple, organisé en deux phases (échantillonnage cartographique puis recommandation culturale), peut répondre efficacement aux besoins d’aide à la décision agricole.  
L’approche par groupes d’étude et l’explication des résultats renforcent l’utilité terrain et la compréhension utilisateur.  
Le travail constitue une base solide pour des extensions futures orientées précision agronomique et adaptation locale.

---

## Bibliographie indicative (à compléter selon vos références exactes)
- Ouvrages et articles sur les DSS agricoles.
- Référentiels agronomiques sur pH, N, P, K, salinité et texture des sols.
- Documentation technique : React, Vite, Leaflet.

---

## Annexes (modèle)
### Annexe A — Paramètres d’entrée du formulaire
- pH
- Azote (N)
- Phosphore (P)
- Potassium (K)
- Salinité
- Température
- Texture
- Matière organique

### Annexe B — Sorties principales
- Score de compatibilité
- Top recommandations par groupe
- Alertes (acidité, alcalinité, salinité)
- Actions de correction proposées
