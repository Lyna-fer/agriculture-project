## 1) Global Use Case Diagram

```mermaid
flowchart LR
  Farmer(("🧑‍🌾\nAgriculteur"))
  Technician(("🧑‍🔬\nTechnicien de laboratoire"))

  subgraph "Système Expert d'Optimisation des Parcelles"
    direction TB
    Login(["Se connecter / accéder à l'application"])
    Browse(["Consulter la carte et les parcelles"])
    Draw(["Dessiner ou sélectionner une parcelle"])
    Validate(["Valider la géométrie et la surface"])
    Sample(["Générer les points d'échantillonnage"])
    Kml(["Télécharger le fichier KML terrain"])
    Diag(["Ouvrir le diagnostic de sol"])
    Prefill(["Pré-remplir les données via satellite"])
    Form(["Saisir les paramètres de sol"])
    Score(["Calculer le score de compatibilité"])
    LabReq(["Imprimer la demande de laboratoire"])
    Report(["Télécharger le rapport de recommandations"])
  end

  Farmer --> Login
  Farmer --> Browse
  Farmer --> Draw
  Farmer --> Diag
  Technician --> LabReq

  Draw -. "«include»" .-> Validate
  Draw -. "«include»" .-> Sample
  Sample -. "«include»" .-> Kml
  Browse -. "«extend»" .-> Draw

  Diag -. "«include»" .-> Form
  Prefill -. "«extend»" .-> Form
  Form -. "«include»" .-> Score
  Score -. "«extend»" .-> LabReq
  Score -. "«extend»" .-> Report
```

## 2) Phase 1 Use Case Diagram: Parcel Selection and Sampling

```mermaid
flowchart LR
  Farmer(("🧑‍🌾\nAgriculteur"))

  subgraph "Phase 1 : Sélection de parcelle et export des points"
    direction TB
    OpenMap(["Ouvrir la carte de travail"])
    SelectWilaya(["Rechercher et centrer la wilaya"])
    DrawParcel(["Dessiner une parcelle (polygone)"])
    CheckGeometry(["Vérifier le minimum de sommets et la validité"])
    CalcArea(["Calculer la surface et le périmètre"])
    ChooseMode(["Choisir le mode d'échantillonnage"])
    GeneratePoints(["Générer les points d'échantillonnage"])
    ShowRightPanel(["Afficher le panneau droit avec les infos de la parcelle"])
    ExportKML(["Télécharger le KML des points"])
  end

  Farmer --> OpenMap
  Farmer --> SelectWilaya
  Farmer --> DrawParcel
  Farmer --> ChooseMode
  Farmer --> ExportKML

  DrawParcel -. "«include»" .-> CheckGeometry
  CheckGeometry -. "«include»" .-> CalcArea
  DrawParcel -. "«include»" .-> ShowRightPanel
  ChooseMode -. "«include»" .-> GeneratePoints
  GeneratePoints -. "«include»" .-> ShowRightPanel
  ExportKML -. "«extend»" .-> GeneratePoints
  SelectWilaya -. "«extend»" .-> DrawParcel
```

## 3) Phase 2 Use Case Diagram: Diagnostic, Recommendations and Laboratory Outputs

```mermaid
flowchart LR
  Farmer(("🧑‍🌾\nAgriculteur"))
  Technician(("🧑‍🔬\nTechnicien de laboratoire"))

  subgraph "Phase 2 : Diagnostic de sol et recommandations"
    direction TB
    OpenDiag(["Ouvrir le diagnostic de sol"])
    Preload(["Pré-remplir via données satellite"])
    FillForm(["Remplir le formulaire (pH, CE, MO, texture, NPK)"])
    LoadCrop(["Sélectionner la culture cible"])
    ComputeScore(["Calculer le score de compatibilité"])
    ShowVerdict(["Afficher le verdict et les alertes"])
    PrintLab(["Imprimer la demande d'analyse de laboratoire"])
    DownloadReport(["Télécharger le rapport de recommandations"])
    SaveHistory(["Archiver les résultats et les recommandations"])
  end

  Farmer --> OpenDiag
  Farmer --> FillForm
  Farmer --> LoadCrop
  Farmer --> PrintLab
  Farmer --> DownloadReport
  Technician --> PrintLab

  OpenDiag -. "«include»" .-> FillForm
  OpenDiag -. "«include»" .-> LoadCrop
  Preload -. "«extend»" .-> FillForm
  FillForm -. "«include»" .-> ComputeScore
  LoadCrop -. "«include»" .-> ComputeScore
  ComputeScore -. "«include»" .-> ShowVerdict
  ComputeScore -. "«extend»" .-> PrintLab
  ComputeScore -. "«extend»" .-> DownloadReport
  ComputeScore -. "«include»" .-> SaveHistory
```