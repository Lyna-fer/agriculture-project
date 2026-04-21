# Chapitre : Réalisation et Implémentation

## Introduction

La phase de réalisation a permis de transformer les besoins fonctionnels du projet **Landing Map** en une application web concrète destinée à l’aide à la décision agricole. L’objectif principal de cette étape était de mettre en place un système capable de délimiter une parcelle, d’en mesurer la surface, de déterminer des zones d’échantillonnage et de produire des résultats exploitables sur le terrain. Cette phase constitue donc la traduction technique de l’analyse fonctionnelle effectuée en amont.

Afin de répondre à cet objectif, le projet a été structuré selon une architecture client-serveur. L’interface utilisateur assure l’interaction avec l’agriculteur à travers une carte interactive et des panneaux de commande, tandis que le backend prend en charge les traitements géospatiaux, l’authentification, la persistance des données et l’export des résultats.

## 1. Architecture générale de l’application

L’architecture retenue repose sur deux niveaux complémentaires. Le premier niveau correspond au frontend, développé avec **React** et initialisé avec **Vite**, qui permet de gérer l’affichage, la navigation entre les composants et les interactions utilisateur. Le second niveau correspond au backend, développé avec **FastAPI**, qui centralise la logique métier et expose les services nécessaires au fonctionnement de l’application.

Ce découpage présente plusieurs avantages. Il sépare clairement la couche de présentation de la couche de traitement, facilite la maintenance du code et permet d’envisager plus facilement des évolutions futures. La solution s’appuie également sur une base de données **PostgreSQL** afin de conserver les parcelles et les échantillons de manière structurée, y compris dans leur dimension géographique.

Les technologies utilisées dans cette réalisation sont principalement **React**, **Vite**, **FastAPI**, **PostgreSQL**, **GeoAlchemy2**, **Turf.js**, **Shapely**, **PyProj** et **Google Earth Engine**.

## 2. Réalisation de l’interface utilisateur

L’interface graphique constitue la partie visible du système. Elle a été conçue autour d’une page carte centrale, qui regroupe les actions principales liées à la gestion des parcelles. L’utilisateur peut y dessiner une parcelle, visualiser les résultats générés et accéder aux fonctions avancées du diagnostic.

### 2.1 La carte interactive

La carte interactive représente l’élément central de l’application. Elle permet à l’utilisateur de dessiner manuellement les contours de sa parcelle en plaçant successivement les sommets du polygone. Une fois le tracé terminé, le système récupère les coordonnées de la géométrie, calcule automatiquement la surface et prépare les informations nécessaires au traitement suivant.

L’ensemble du mécanisme a été accompagné d’une validation simple afin de garantir la cohérence du tracé. Cette validation vise notamment à éviter les parcelles incomplètes ou géométriquement incohérentes. La carte joue ainsi le rôle de point d’entrée de toute la chaîne de traitement.

### 2.2 Le panneau latéral de commande

Le panneau latéral gauche regroupe les actions principales liées à la parcelle. Il permet de lancer le dessin, de choisir la culture, d’enregistrer les données ou de supprimer une parcelle existante. Ce panneau améliore la lisibilité de l’application, car il concentre les commandes essentielles dans un espace facilement accessible.

Il fournit également des informations contextuelles sur l’état de la parcelle en cours de traitement. L’utilisateur sait ainsi à quel stade il se trouve dans le flux d’utilisation, ce qui rend l’expérience plus fluide et plus intuitive.

### 2.3 Le panneau de résultats

Une fois l’analyse effectuée, le panneau de résultats affiche les informations essentielles relatives à la parcelle. On y retrouve les zones générées, les caractéristiques de la parcelle et les principales actions disponibles, notamment l’accès au diagnostic du sol et le téléchargement du fichier KML.

Ce panneau a été pensé comme un espace de synthèse. Il présente les résultats de manière structurée et permet à l’utilisateur de consulter rapidement les éléments utiles sans être noyé dans des détails techniques.

### 2.4 Le diagnostic agronomique

Le module de diagnostic agronomique permet d’évaluer la compatibilité entre la culture sélectionnée et les caractéristiques du terrain. L’évaluation repose sur plusieurs paramètres, parmi lesquels le pH, la salinité, la matière organique, le calcaire actif, la texture et la pente. Cette fonctionnalité illustre le caractère décisionnel du projet, car elle convertit des données techniques en indications compréhensibles et directement exploitables.

## 3. Implémentation du backend

Le backend constitue la couche de traitement du système. Il a été développé avec **FastAPI** afin de fournir une API claire, rapide et facile à maintenir. Il gère l’authentification, reçoit les données transmises par le frontend, exécute les traitements géospatiaux et renvoie les résultats sous une forme exploitable par l’interface.

### 3.1 Gestion de l’authentification

Le système intègre un mécanisme d’authentification basé sur des comptes utilisateurs et des jetons JWT. Lors de l’inscription, les informations saisies sont vérifiées afin de détecter d’éventuels doublons. Le mot de passe est ensuite haché avant d’être stocké dans la base de données, ce qui renforce la sécurité du système.

Lors de la connexion, le backend compare les identifiants saisis avec ceux enregistrés. En cas de validation, un jeton d’accès est généré et utilisé pour protéger les routes sensibles. Ce mécanisme permet d’identifier l’utilisateur courant dans les opérations de lecture, d’écriture ou de suppression.

### 3.2 Modélisation des données

La structure des données repose sur plusieurs entités principales. **AuthUser** représente le compte utilisateur, **Farmer** correspond au profil agricole, **Parcelle** décrit la géométrie de la parcelle et **SoilSample** stocke les échantillons ou points de prélèvement associés.

Cette modélisation assure une cohérence entre la cartographie affichée dans le frontend et les données conservées dans la base. Les parcelles sont enregistrées sous forme de polygones géographiques, tandis que les points d’échantillonnage sont représentés comme des géométries ponctuelles.

### 3.3 Services exposés par l’API

L’API regroupe plusieurs routes correspondant aux fonctionnalités principales de l’application. Les routes d’inscription et de connexion assurent la gestion des comptes. D’autres routes sont dédiées à la récupération des parcelles, à leur suppression, à l’analyse de la parcelle et à l’export des points d’échantillonnage au format KML.

Cette organisation permet de bien séparer les responsabilités et d’obtenir une API lisible, où chaque route correspond à une action fonctionnelle clairement identifiée.

## 4. Traitements géospatiaux

L’un des aspects les plus importants de cette réalisation concerne le traitement géospatial. Le système doit en effet calculer la surface de la parcelle, déterminer le nombre de zones à générer et produire des points de prélèvement adaptés à la culture choisie.

### 4.1 Calcul de la surface

Le calcul de la surface se fait à partir des coordonnées de la parcelle tracée. L’interface fournit une première estimation, puis le backend confirme la valeur à l’aide d’un calcul géodésique basé sur le système de référence WGS84. Ce calcul est indispensable, car il constitue la base du découpage en zones et de la génération des points.

### 4.2 Découpage en zones

Le nombre de zones dépend de la surface totale et du mode d’échantillonnage. En mode standard, le découpage est lié à la stratégie agricole de la culture sélectionnée. En mode économique, le système applique une logique simplifiée qui réduit le nombre de zones afin de limiter le volume des prélèvements.

Le découpage est réalisé de manière récursive. Le polygone de départ est scindé en sous-parties selon son orientation dominante, puis chaque sous-zone est conservée si sa surface reste suffisante. Cette approche évite la création de fragments trop petits et permet d’obtenir des zones agronomiquement exploitables.

### 4.3 Génération des points d’échantillonnage

Les points d’échantillonnage sont générés à l’intérieur de chaque zone selon une densité déterminée par la culture. Le système prend en compte plusieurs stratégies de prélèvement, notamment pour les cultures maraîchères, les céréales et les cultures pérennes. Chaque stratégie définit des paramètres spécifiques tels que la profondeur, le nombre minimal de carottes et le nombre maximal d’échantillons.

La génération des points vise une répartition homogène sur l’ensemble de la parcelle. Lorsque cela est possible, les points sont disposés selon une logique de grille afin de couvrir correctement la zone. Si les points candidats sont insuffisants, le système bascule vers une génération aléatoire contrôlée dans le polygone.

### 4.4 Export des résultats au format KML

Afin de rendre les résultats exploitables sur le terrain, un export au format KML a été implémenté. Ce format est compatible avec Google Earth et avec d’autres outils de navigation mobile. Les zones et les points d’échantillonnage sont regroupés dans un document structuré, ce qui facilite leur consultation sur le terrain.

Cet export représente le lien entre l’analyse informatique et l’usage pratique. Il permet à l’agriculteur de retrouver facilement les points de prélèvement lors de la campagne d’échantillonnage.

## 5. Intégration des données satellitaires

Le projet intègre également une dimension satellitaire afin d’enrichir l’analyse de la parcelle. Cette partie permet d’extraire certaines informations géospatiales et de fournir une première indication sur la qualité ou la nature du terrain avant la réalisation des analyses de laboratoire.

Le backend s’appuie sur **Google Earth Engine** et sur des jeux de données géospatiales pour compléter le traitement des parcelles. Cette intégration apporte une valeur ajoutée importante, car elle améliore la capacité d’évaluation du système.

## 6. Validation et fiabilité

Plusieurs mécanismes de validation ont été ajoutés afin d’assurer la robustesse de l’application. Le code vérifie notamment que la parcelle possède un nombre suffisant de points pour former un polygone, que les paramètres transmis au serveur sont cohérents et que les traitements géospatiaux se déroulent dans des conditions valides.

Des messages de retour et des notifications ont également été prévus pour informer l’utilisateur en cas de succès ou d’erreur. Cette approche améliore la fiabilité perçue du système et facilite son utilisation au quotidien.

## Conclusion

La phase de réalisation a permis de mettre en œuvre une solution structurée, fonctionnelle et adaptée au contexte agricole. L’intégration du frontend cartographique, du backend FastAPI, de la base de données et des traitements géospatiaux a abouti à une application cohérente et exploitable.

Ce travail a mis en évidence l’importance d’une architecture claire, d’une modélisation rigoureuse des données et d’une interface adaptée à l’utilisateur final. Le projet constitue ainsi une base solide pour les évolutions futures, notamment l’enrichissement des analyses, l’ajout de nouvelles cultures et l’amélioration des recommandations agronomiques.