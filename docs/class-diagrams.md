# Project Class Diagrams

This document provides complete UML-style class diagrams for the project.
Only essential functions are shown.

## 1) Backend Domain Model (SQLAlchemy + Pydantic)

```mermaid
classDiagram
    direction LR

    class AuthUser {
        +id: int
        +username: str
        +email: str
        +password: str
        +is_active: bool
        +date_joined: datetime
    }

    class Farmer {
        +id: int
        +nom: str
        +prenom: str
        +email: str
    }

    class Parcelle {
        +id: int
        +user_id: int
        +farmerid: int
        +nom: str
        +surface: numeric
        +location: POLYGON
    }

    class SoilSample {
        +id: int
        +parcelle_id: int
        +zone_name: str
        +geometrie: POINT
        +depth: numeric
        +date_echantillon: date
        +statut: str
    }

    class UserCreate {
        +username: str
        +email: str
        +password: str
    }

    class Token {
        +access_token: str
        +token_type: str
        +user_id: int
        +username: str
    }

    class SamplingRequest {
        +polygonPoints: list
        +cropType: str
        +samplingMode: str
        +parcelleName: str?
    }

    class SatelliteSoilRequest {
        +polygonPoints: list
    }

    AuthUser "1" --> "0..*" Parcelle : owns
    Parcelle "1" --> "0..*" SoilSample : contains
    Farmer "0..1" --> "0..*" Parcelle : linked by farmerid
```

## 2) Backend Service and API Layer

```mermaid
classDiagram
    direction TB

    class FastAPIApp {
        <<controller>>
        +register(user, db)
        +login(form_data, db)
        +run_and_save(request, current_user, db)
        +get_satellite_soil_metrics(request, current_user)
        +get_parcels(current_user, db)
        +delete_parcel(parcel_id, current_user, db)
    }

    class AuthService {
        <<service>>
        +verify_django_password(plain, hashed) bool
        +create_access_token(data, expires_delta) str
        +get_current_user(token, db) AuthUser
    }

    class SamplingPipeline {
        <<service>>
        +run_sampling_pipeline(polygon_points, crop_type, sampling_mode) dict
        +compute_num_zones(total_area_ha, strategy, sampling_mode) int
        +build_zones(drawn_polygon, total_area_ha, num_zones, strategy, sampling_mode) list
        +generate_points(poly, area_ha, strategy, density_factor) list
    }

    class GeometryUtils {
        <<utility>>
        +safe_intersect(poly_a, poly_b) Polygon
        +calculate_area_hectares(coords) float
    }

    class SatelliteMetricsService {
        <<service>>
        +_to_ee_polygon(latlngs) ee.Geometry
        +_compute_satellite_metrics(geometry) dict
    }

    class PersistenceService {
        <<service>>
        +_compute_geometry_hash(coords) str
    }

    FastAPIApp --> AuthService
    FastAPIApp --> SamplingPipeline
    FastAPIApp --> SatelliteMetricsService
    FastAPIApp --> PersistenceService
    SamplingPipeline --> GeometryUtils
```

## 3) Frontend App and Routing Structure

```mermaid
classDiagram
    direction TB

    class MainEntry {
        <<bootstrap>>
        +render()
    }

    class App {
        <<component>>
        +isAuthenticated() bool
    }

    class ProtectedRoute {
        <<component>>
        +render(children)
    }

    class LandingPage {
        <<component>>
        +onEnter()
    }

    class LoginPage {
        <<component>>
        +handleSubmit(event)
    }

    class MapPage {
        <<component>>
        +handleAnalyze()
        +handleStartSampling()
        +handleDeleteParcelle(id)
        +handleClearAll()
    }

    class LandingNavbar {
        <<component>>
    }

    class Hero {
        <<component>>
    }

    class Products {
        <<component>>
    }

    class Industries {
        <<component>>
    }

    class Stats {
        <<component>>
    }

    class Testimonials {
        <<component>>
    }

    class Footer {
        <<component>>
    }

    MainEntry --> App
    App --> ProtectedRoute
    App --> LandingPage
    App --> LoginPage
    App --> MapPage

    LandingPage --> LandingNavbar
    LandingPage --> Hero
    LandingPage --> Products
    LandingPage --> Industries
    LandingPage --> Stats
    LandingPage --> Testimonials
    LandingPage --> Footer
```

## 4) Frontend Map Module (Core Flow)

```mermaid
classDiagram
    direction LR

    class MapPage {
        <<component>>
        +handleAnalyze()
        +handleStartSampling()
        +renderSamplingPoints(state)
        +openGoogleMapsForBatch(state)
    }

    class useMap {
        <<hook>>
        +activateDrawTool(tool)
        +drawParcelleFromLatLngs(latlngs, color)
        +displayZones(zones, samplingMode)
        +placeSamplePoints(zones, color, options)
        +clearAll()
    }

    class LeftPanel {
        <<component>>
        +onGenerate()
        +onSaveParcelle()
        +onClearAll()
    }

    class MapView {
        <<component>>
        +onSelectWilaya(wilaya)
    }

    class ResultsPanel {
        <<component>>
        +buildKpis(data, nSamples, parcelleHa)
        +onStartSampling()
    }

    class DrawPanel {
        <<component>>
        +onSave()
        +onCancel()
    }

    class SearchBar {
        <<component>>
        +handleInput(event)
        +handleSelect(wilaya)
    }

    class WilayaInfoPanel {
        <<component>>
        +handleClose()
    }

    class SoilDiagnostic {
        <<component>>
        +onAnalyze()
        +onReset()
    }

    class SamplingLogicService {
        <<service>>
        +initializeSamplingState(zones)
        +getCurrentBatchPoints(zones, state)
        +markPointDone(state, batchIndex)
        +advanceSamplingBatch(zones, state, batchSize)
    }

    class SamplingEngine {
        <<library>>
        +computePreview(polygonPoints, cropType, samplingMode)
        +computeNumZones(totalAreaHa, strategy, samplingMode)
        +authenticateGEE()
    }

    class DataCatalog {
        <<data>>
        +CULTURES
        +WILAYAS
        +ZONE_COLORS
    }

    MapPage --> useMap
    MapPage --> LeftPanel
    MapPage --> MapView
    MapPage --> ResultsPanel
    MapPage --> SamplingLogicService
    MapPage --> SamplingEngine

    LeftPanel --> DrawPanel
    MapView --> SearchBar
    MapView --> WilayaInfoPanel
    ResultsPanel --> SoilDiagnostic
    SearchBar --> DataCatalog
    ResultsPanel --> DataCatalog
```

## 5) Optional Data Utility Modules

```mermaid
classDiagram
    direction LR

    class CropData {
        <<data-module>>
        +getCropsByGroup(groupId)
        +findCropById(id)
    }

    class CulturesData {
        <<data-module>>
        +CULTURES
    }

    class WilayasData {
        <<data-module>>
        +WILAYAS
        +ZONE_COLORS
    }

    CropData --> CulturesData
    WilayasData --> CulturesData
```
