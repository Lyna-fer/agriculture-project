# Diagrammes de Cas d'Utilisation (Système Agritech)

## 1. Diagramme de Cas d'Utilisation Global

```mermaid
flowchart LR
    %% Acteurs
    User["Acteur: Utilisateur"]
    GEE["Système: Google Earth Engine"]
    DB["Système: Base de Données (PostGIS)"]

    %% Système
    subgraph Systeme ["Système Agritech"]
        UC1(["Délimiter une parcelle"])
        UC2(["Générer le plan d'échantillonnage"])
        UC3(["Récupérer les données satellitaires"])
        UC4(["Évaluer la compatibilité du sol"])
    end

    %% Relations
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4

    UC1 --> DB
    UC2 --> DB
    UC3 --> GEE

    ```mermaid
    flowchart LR
    User["Acteur: Utilisateur"]
    DB["Base de Données"]

    subgraph Mod1 ["Gestion Spatiale de la Parcelle"]
        P1(["Tracer le polygone sur la carte"])
        P2(["Calculer la surface géodésique"])
        P3(["Détecter les doublons spatiaux"])
        P4(["Sauvegarder la géométrie et métadonnées"])
    end

    User --> P1
    User --> P4

    P1 -. "<< include >>" .-> P2
    P4 -. "<< include >>" .-> P3
    
    P4 --> DB

    ```mermaid
    flowchart TB
    User["Acteur: Utilisateur"]
    DB["Base de Données"]

    subgraph Mod2 ["Moteur d'Échantillonnage"]
        E1(["Sélectionner la culture et le mode"])
        E2(["Exécuter l'algorithme de zonage Square-split"])
        E3(["Générer les points (Serpentin)"])
        E4(["Sauvegarder les zones et points"])
        E5(["Exporter le plan au format KML"])
    end

    User --> E1
    User --> E5

    E1 --> E2
    E2 --> E3
    E3 --> E4
    
    E4 --> DB

    ```mermaid
    flowchart LR
    User["Acteur: Utilisateur"]
    GEE["API Google Earth Engine"]

    subgraph Mod3 ["Diagnostic et Recommandations"]
        D1(["Demander le diagnostic satellitaire"])
        D2(["Extraire pH, CE, Température, Texture"])
        D3(["Ajuster manuellement les paramètres NPK"])
        D4(["Calculer le score de compatibilité"])
        D5(["Générer les recommandations agronomiques"])
        D6(["Déclencher une alerte de toxicité"])
    end

    User --> D1
    User --> D3
    User --> D4

    D1 --> D2
    D2 --> GEE
    
    D4 -. "<< include >>" .-> D5
    D4 -. "<< extend >>" .-> D6