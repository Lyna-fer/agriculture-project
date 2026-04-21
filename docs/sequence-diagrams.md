# Project Sequence Diagrams

This document provides the key sequence diagrams for the project.
Only essential interactions are included.

## 1) User Registration Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Visitor
    participant Frontend as LoginPage.jsx
    participant API as FastAPI /api/auth/register
    participant DB as PostgreSQL

    Visitor->>Frontend: Fill username/email/password
    Frontend->>API: POST register payload
    API->>DB: Check existing username/email
    DB-->>API: Exists/Not exists

    alt user exists
        API-->>Frontend: 400 error
        Frontend-->>Visitor: Show error message
    else user does not exist
        API->>API: Hash password (PBKDF2)
        API->>DB: Insert AuthUser
        API->>DB: Insert Farmer profile
        DB-->>API: Commit OK
        API-->>Frontend: Registration success
        Frontend-->>Visitor: Prompt to sign in
    end
```

## 2) User Login and Protected Route Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as LoginPage.jsx
    participant API as FastAPI /api/auth/login
    participant DB as PostgreSQL
    participant Router as App.jsx ProtectedRoute

    User->>Frontend: Enter username/password
    Frontend->>API: POST form-urlencoded credentials
    API->>DB: Find AuthUser by username
    DB-->>API: User record
    API->>API: verify_django_password()

    alt invalid credentials
        API-->>Frontend: 401 Unauthorized
        Frontend-->>User: Show login error
    else valid credentials
        API->>API: create_access_token()
        API-->>Frontend: JWT token + user info
        Frontend->>Frontend: Save token in localStorage
        Frontend->>Router: Navigate /map
        Router->>Router: isAuthenticated()
        Router-->>User: Render Map page
    end
```

## 3) Draw Parcel and Save in UI Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant LeftPanel as LeftPanel.jsx
    participant MapPage as Map.jsx
    participant Hook as useMap.js
    participant Leaflet as Leaflet Draw

    Farmer->>LeftPanel: Click Polygon/Rectangle tool
    LeftPanel->>MapPage: onToolClick(tool)
    MapPage->>Hook: activateDrawTool(tool)
    Hook->>Leaflet: Enable drawing handler

    Farmer->>Leaflet: Draw parcel on map
    Leaflet-->>Hook: Draw.CREATED event(layer)
    Hook->>Hook: computeStats(layer)
    Hook-->>MapPage: onParcelleChange(stats)
    MapPage->>MapPage: Set pendingParcelleInfo
    MapPage-->>Farmer: Show toast + naming prompt
```

## 4) Run Sampling Analysis and Save to DB Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant MapPage as Map.jsx
    participant API as FastAPI /api/sampling/run-and-save
    participant Pipeline as run_sampling_pipeline()
    participant GEE as Google Earth Engine
    participant DB as PostgreSQL/PostGIS

    Farmer->>MapPage: Click Generate Sampling Guide
    MapPage->>API: POST polygonPoints, cropType, samplingMode, parcelleName

    API->>Pipeline: Execute sampling pipeline
    Pipeline->>Pipeline: calculate_area_hectares()
    Pipeline->>Pipeline: compute_num_zones()
    Pipeline->>GEE: Query soil texture raster
    GEE-->>Pipeline: Texture class result
    Pipeline->>Pipeline: build_zones()
    Pipeline->>Pipeline: generate_points()
    Pipeline-->>API: zones + area + soil data

    API->>DB: Check duplicate parcel (user + name)
    alt duplicate parcel
        API-->>MapPage: Return existing parcel id
    else new parcel
        API->>DB: Insert Parcelle geometry
        API->>DB: Insert SoilSample points
        DB-->>API: Commit OK
        API-->>MapPage: Return savedParcelleId + zones
    end

    MapPage->>Hook: displayZones(zones)
    MapPage->>Hook: placeSamplePoints(zones)
    MapPage-->>Farmer: Show results panel and success toast
```

## 5) Guided Sampling Batch Navigation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant Results as ResultsPanel.jsx
    participant MapPage as Map.jsx
    participant Service as samplingLogic.js
    participant Hook as useMap.js
    participant Maps as Google Maps

    Farmer->>Results: Click Start Sampling
    Results->>MapPage: onStartSampling()

    alt first start
        MapPage->>Service: initializeSamplingState(zones)
        Service-->>MapPage: initial state
    else already in progress
        MapPage->>Service: getCurrentBatchPoints(zones, state)
        Service-->>MapPage: current batch points
    end

    MapPage->>MapPage: openGoogleMapsForBatch(points)
    MapPage->>Maps: Open walking route URL
    Maps-->>Farmer: Display route

    Farmer->>Hook: Click completed point marker
    Hook-->>MapPage: onPointClick(zoneIdx, pointIdx)
    MapPage->>Service: markPointDone(state, batchIndex)
    Service-->>MapPage: updated state

    MapPage->>Service: advanceSamplingBatch(zones, state)
    Service-->>MapPage: next batch / next zone / null

    alt work remains
        MapPage->>Hook: renderSamplingPoints(updated state)
    else completed
        MapPage->>Hook: clearSamplingMarkers()
        MapPage-->>Farmer: Show completion toast
    end
```

## 6) Satellite Soil Metrics Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant Frontend as Map/Diagnostic UI
    participant API as FastAPI /api/satellite/soil-metrics
    participant GEE as Google Earth Engine

    Farmer->>Frontend: Request satellite metrics
    Frontend->>API: POST polygonPoints + JWT
    API->>API: _to_ee_polygon()
    API->>GEE: Landsat query (salinity proxy)
    API->>GEE: SoilGrids query (pH)
    API->>GEE: OpenLandMap query (texture)
    API->>GEE: MODIS query (temperature)
    GEE-->>API: Aggregated metric values
    API-->>Frontend: salinity, pH, texture, temperature
    Frontend-->>Farmer: Display soil diagnostic values
```

## 7) Parcel Listing and Deletion Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant Frontend as Map.jsx + LeftPanel.jsx
    participant API as FastAPI /api/parcels
    participant DB as PostgreSQL/PostGIS

    Frontend->>API: GET /api/parcels (on page load)
    API->>DB: Query parcels by user_id
    DB-->>API: Parcel rows + geometry
    API-->>Frontend: Parcel DTO list
    Frontend-->>Farmer: Show parcel cards

    Farmer->>Frontend: Delete selected parcel
    Frontend->>Frontend: Optimistic UI removal
    Frontend->>API: DELETE /api/parcels/{id}
    API->>DB: Delete SoilSample by parcelle_id
    API->>DB: Delete Parcelle
    DB-->>API: Commit OK
    API-->>Frontend: Delete confirmation
    Frontend-->>Farmer: Show success toast
```

## 8) Wilaya Search and Info Panel Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer
    participant Search as SearchBar.jsx
    participant Data as data/wilayas.js
    participant MapPage as Map.jsx
    participant Hook as useMap.js
    participant Panel as WilayaInfoPanel.jsx

    Farmer->>Search: Type wilaya name/code
    Search->>Data: Filter WILAYAS
    Data-->>Search: Top matches
    Search-->>Farmer: Show dropdown

    Farmer->>Search: Select wilaya
    Search-->>MapPage: onSelectWilaya(wilaya)
    MapPage->>Hook: flyToWilaya(wilaya)
    MapPage->>Panel: Set selected wilaya
    Panel-->>Farmer: Show zone badge + recommendation
```
