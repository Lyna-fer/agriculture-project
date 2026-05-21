# Project Class Diagram

This diagram uses the real source file names as class names, and only functions that actually exist in the codebase.

```mermaid
classDiagram
    direction LR

    class App {
        <<file>>
        +isAuthenticated()
        +ProtectedRoute()
    }

    class Landing {
        <<file>>
    }

    class LoginPage {
        <<file>>
        +mode: string
        +email: string
        +username: string
        +password: string
        +handleSubmit()
    }

    class Map {
        <<file>>
        +parcelles: Array
        +selectedParcelleId: number | null
        +selectedGroupId: number | null
        +isAnalyzing: boolean
        +buildDashboardSnapshotFromRow()
        +buildDashboardSessionFromDb()
    }

    class SoilDiagnostic {
        <<file>>
        +SAT_DEFAULTS: object
        +SAT_FIELDS: object
        +ZONE_COLORS: string[]
        +tab: string
        +weather: object | null
        +buildLabRequestHtml()
        +buildZoneReportHtml()
        +buildAnalysisSnapshot()
    }

    class LeftPanel {
        <<file>>
        +showClearConfirm: boolean
        +profileMenuOpen: boolean
        +canGenerate: boolean
        +drawPanelOpen: boolean
        +handleConfirmClear()
        +handleDashboardClick()
    }

    class ResultsPanel {
        <<file>>
        +TABS: Array
        +PALETTE: string[]
        +tab: string
        +weather: object | null
        +buildSamplingWeatherAdvice()
        +buildSeasonalSamplingTips()
        +buildKpis()
    }

    class useMap {
        <<file>>
        +mapRef: RefObject
        +mapInstanceRef: RefObject
        +drawnItemsRef: RefObject
        +MIN_ZOOM_FOR_MARKERS: number
        +mapReady: boolean
        +computeStats()
        +drawAllParcelles()
        +clearAllParcelles()
    }

    class soilDashboardStorage {
        <<file>>
        +SOIL_DASHBOARD_UPDATED_EVENT: string
    }

    class samplingEngine {
        <<file>>
        +GEE_CLIENT_ID: string
        +GEE_PROJECT_ID: string
        +CROP_STRATEGIES: object
        +MAX_PARCEL_AREA_HA: number
        +generatePoints()
        +computeNumZones()
        +buildZones()
        +runSamplingPipeline()
    }

    class main {
        <<file>>
        +NEON_URL: string
        +engine: object
        +SessionLocal: object
        +app: FastAPI
        +get_db()
        +register()
        +login()
        +run_and_save()
        +create_parcel()
        +get_parcels()
        +delete_parcel()
        +save_zone_analysis()
        +get_parcel_analyses()
    }

    class sampling {
        <<file>>
        +MAX_PARCEL_AREA_HA: number
        +calculate_area_hectares()
        +compute_num_zones()
        +build_zones()
        +run_sampling_pipeline()
    }

    class kml_export {
        <<file>>
        +build_sampling_kml()
    }

    App "1" --> "1" Landing : route
    App "1" --> "1" LoginPage : route
    App "1" --> "1" Map : route

    Map "1" --> "1" SoilDiagnostic : uses
    Map "1" --> "1" LeftPanel : uses
    Map "1" --> "1" ResultsPanel : uses
    Map "1" --> "1" useMap : uses
    Map "1" --> "1" soilDashboardStorage : uses
    Map "1" --> "1" samplingEngine : uses

    main "1" --> "1" sampling : imports
    main "1" --> "1" kml_export : imports

    %% Database models and cardinalities (verified from Backend/main.py)
    class AuthUser {
        <<db model>>
        +id: int
        +username: string
        +email: string
        +is_active: boolean
    }

    class Parcelle {
        <<db model>>
        +id: int
        +user_id: int
        +surface: number
        +location: Geometry
    }

    class SoilSample {
        <<db model>>
        +id: int
        +parcelle_id: int
        +geometrie: Point
        +date_echantillon: Date
    }

    class ZoneAnalysis {
        <<db model>>
        +id: int
        +parcelle_id: int
        +user_id: int
        +soil_metrics: JSON
        +analyzed_at: DateTime
    }

    AuthUser "1" --> "*" Parcelle : owns
    Parcelle "1" --> "*" SoilSample : contains
    Parcelle "1" --> "*" ZoneAnalysis : analyzed
    AuthUser "1" --> "*" ZoneAnalysis : performs

```

## What Each Function Does

### App
- `isAuthenticated()` checks whether a token exists in `localStorage`.
- `ProtectedRoute()` blocks protected pages unless the user is authenticated.

### LoginPage
- `handleSubmit()` sends the login or register request and stores the token on success.

### Landing
- `Landing()` is the landing-page component; it sets the page body class and navigates to login when the user enters.

### Map
- `buildDashboardSnapshotFromRow()` turns one analysis row into a dashboard snapshot object.
- `buildDashboardSessionFromDb()` rebuilds the full dashboard session from saved database rows.

### SoilDiagnostic
- `buildLabRequestHtml()` creates the HTML used for the lab request print/export view.
- `buildZoneReportHtml()` creates the HTML report for a zone analysis.
- `buildAnalysisSnapshot()` packages the analysis state into a snapshot for storage or export.

### LeftPanel
- `handleConfirmClear()` confirms the clear-all action and then clears the parcels.
- `handleDashboardClick()` opens the dashboard only when it is available.

### ResultsPanel
- `buildSamplingWeatherAdvice()` creates sampling advice from weather conditions.
- `buildSeasonalSamplingTips()` creates crop-season sampling tips.
- `buildKpis()` creates the KPI cards shown in the results panel.

### useMap
- `computeStats()` computes parcel area, perimeter, and bounds.
- `drawAllParcelles()` redraws every parcel polygon and its label.
- `clearAllParcelles()` removes every parcel layer from the map.

### soilDashboardStorage
- `getDashboardHistory()` returns the latest and previous analysis entries.
- `saveDashboardState()` stores the latest dashboard state and keeps only the last two entries.
- `isParcelleAnalysisComplete()` checks whether the required zone results are complete.
- `clearDashboardHistory()` removes all saved dashboard data for one parcel.

### samplingEngine
- `generatePoints()` generates sampling points inside a polygon.
- `computeNumZones()` decides how many zones to create based on area and sampling mode.
- `buildZones()` splits a parcel into zones and generates points for each zone.
- `runSamplingPipeline()` is the frozen frontend stub that returns mock sampling results.

### main
- `get_db()` opens a database session and closes it after use.
- `register()` creates a new auth user and farmer record.
- `login()` verifies credentials and returns a JWT token.
- `run_and_save()` runs the sampling pipeline and stores soil samples in the database.
- `create_parcel()` creates or reuses a parcel record.
- `get_parcels()` returns all parcels owned by the current user.
- `delete_parcel()` deletes one parcel and its related data.
- `save_zone_analysis()` stores one analyzed zone result.
- `get_parcel_analyses()` returns the latest two analyses per zone for a parcel.

### sampling
- `calculate_area_hectares()` computes polygon area in hectares.
- `compute_num_zones()` decides the number of zones for a parcel.
- `build_zones()` splits the parcel into sampling zones.
- `run_sampling_pipeline()` runs the full backend sampling process.

### kml_export
- `build_sampling_kml()` builds the full KML document for all zones and points.