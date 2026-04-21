# Project Use Case Diagrams

This document provides the use case diagrams for the project.
Only essential use cases are included.

## 1) Global System Use Case Diagram

```mermaid
flowchart LR
  Farmer["Actor: Farmer (Authenticated User)"]
  Visitor["Actor: Visitor"]
  EarthEngine["External: Google Earth Engine"]
  DB["External: PostgreSQL/PostGIS"]
  Maps["External: Google Maps"]

  subgraph System["Agric Web + API System"]
    UC1((Browse landing page))
    UC2((Register account))
    UC3((Login))
    UC4((Draw parcel on map))
    UC5((Save parcel))
    UC6((Run soil sampling analysis))
    UC7((View generated zones and points))
    UC8((Start guided sampling batches))
    UC9((Open route in Google Maps))
    UC10((View satellite soil metrics))
    UC11((List my parcels))
    UC12((Delete parcel))
    UC13((Search wilaya and view info))
  end

  Visitor --> UC1
  Visitor --> UC2
  Visitor --> UC3

  Farmer --> UC4
  Farmer --> UC5
  Farmer --> UC6
  Farmer --> UC7
  Farmer --> UC8
  Farmer --> UC10
  Farmer --> UC11
  Farmer --> UC12
  Farmer --> UC13

  UC5 --> DB
  UC6 --> EarthEngine
  UC6 --> DB
  UC10 --> EarthEngine
  UC11 --> DB
  UC12 --> DB
  UC9 --> Maps
  UC8 --> UC9
```

## 2) Authentication Use Cases

```mermaid
flowchart TB
  Visitor["Actor: Visitor"]
  DB["External: PostgreSQL"]

  subgraph Auth["Authentication Subsystem"]
    A1((Register account))
    A2((Validate unique username/email))
    A3((Hash password))
    A4((Create auth user + farmer profile))
    A5((Login with username/password))
    A6((Verify Django PBKDF2 password))
    A7((Issue JWT token))
    A8((Get current user from JWT))
  end

  Visitor --> A1
  Visitor --> A5

  A1 --> A2
  A1 --> A3
  A1 --> A4
  A4 --> DB

  A5 --> A6
  A5 --> A7
  A6 --> DB

  A8 --> DB
```

## 3) Parcel and Sampling Use Cases

```mermaid
flowchart LR
  Farmer["Actor: Farmer"]
  EarthEngine["External: Google Earth Engine"]
  DB["External: PostgreSQL/PostGIS"]

  subgraph Sampling["Parcel + Sampling Subsystem"]
    S1((Draw polygon/rectangle parcel))
    S2((Select crop group))
    S3((Select sampling mode standard/economic))
    S4((Run analysis and save))
    S5((Compute area and number of zones))
    S6((Get soil texture from satellite))
    S7((Split parcel into zones))
    S8((Generate sampling points))
    S9((Persist parcel))
    S10((Persist soil samples))
    S11((Display results panel))
  end

  Farmer --> S1
  Farmer --> S2
  Farmer --> S3
  Farmer --> S4

  S4 --> S5
  S4 --> S6
  S4 --> S7
  S4 --> S8
  S4 --> S9
  S4 --> S10
  S4 --> S11

  S6 --> EarthEngine
  S9 --> DB
  S10 --> DB
```

## 4) Guided Field Sampling Use Cases

```mermaid
flowchart TB
  Farmer["Actor: Farmer"]
  Maps["External: Google Maps"]

  subgraph Guided["Guided Sampling Workflow"]
    G1((Initialize sampling state))
    G2((Build current batch points))
    G3((Open walking route))
    G4((Mark point as done))
    G5((Advance to next batch))
    G6((Advance to next zone))
    G7((Complete all zones))
  end

  Farmer --> G1
  Farmer --> G3
  Farmer --> G4

  G1 --> G2
  G2 --> G3
  G3 --> Maps
  G4 --> G5
  G5 --> G6
  G6 --> G7
```

## 5) Parcel Management and Geographic Info Use Cases

```mermaid
flowchart LR
  Farmer["Actor: Farmer"]
  DB["External: PostgreSQL/PostGIS"]

  subgraph ParcelMgmt["Parcel Management + Geo Info"]
    P1((List my saved parcels))
    P2((Select parcel and redraw on map))
    P3((Delete one parcel))
    P4((Clear all parcels))
    P5((Search wilaya))
    P6((View wilaya agro-climatic recommendation))
    P7((Request satellite soil metrics for parcel))
  end

  Farmer --> P1
  Farmer --> P2
  Farmer --> P3
  Farmer --> P4
  Farmer --> P5
  Farmer --> P6
  Farmer --> P7

  P1 --> DB
  P3 --> DB
  P4 --> DB
  P7 --> DB
```

## 6) Actor Summary

- Visitor
- Farmer (authenticated user)
- Google Earth Engine (external geospatial service)
- PostgreSQL/PostGIS (persistent storage)
- Google Maps (external routing/navigation)
