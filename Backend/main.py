import ee
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from Backend.services.sampling import run_sampling_pipeline
import asyncio
import os
from typing import List, Optional

# ─── DATABASE SETUP (Neon PostgreSQL + PostGIS) ─────────────────────────────
from sqlalchemy import create_engine, Column, Integer, String, Float, Numeric, Date, ForeignKey, select
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry  # For PostGIS geometry columns

# Your teammate's Neon URL (from their message)
NEON_URL = os.getenv(
    "NEON_URL",
    "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

engine = create_engine(NEON_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── MODELS (Mapping to EXISTING tables - DO NOT CREATE NEW ONES) ────────────
class Farmer(Base):
    __tablename__ = "farmer"
    __table_args__ = {'extend_existing': True}  # Map to existing table

    id = Column(Integer, primary_key=True)
    nom = Column(String)
    prenom = Column(String)
    email = Column(String)

    parcelles = relationship("Parcelle", back_populates="farmer", foreign_keys="Parcelle.farmerid")


class Parcelle(Base):
    __tablename__ = "parcelles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    farmerid = Column(Integer, ForeignKey("farmer.id"))
    nom = Column(String)
    surface = Column(Numeric)  # surface in hectares
    location = Column(Geometry("POLYGON", srid=4326))  # PostGIS geometry

    farmer = relationship("Farmer", back_populates="parcelles", foreign_keys=[farmerid])
    soil_samples = relationship("SoilSample", back_populates="parcelle")


class SoilSample(Base):
    __tablename__ = "soil_samples"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    parcelle_id = Column(Integer, ForeignKey("parcelles.id"))
    zone_name = Column(String)
    geometrie = Column(Geometry("POINT", srid=4326))  # PostGIS POINT
    depth = Column(Numeric)
    date_echantillon = Column(Date)
    statut = Column(String)  # "à faire", "fait", etc.

    parcelle = relationship("Parcelle", back_populates="soil_samples")


# ─── DATABASE DEPENDENCY ────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── FASTAPI APP ────────────────────────────────────────────────────────────
app = FastAPI(title="AgriTech Backend", version="1.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize GEE at startup (DB tables already exist - NO create_all needed)
@app.on_event("startup")
def startup_event():
    ee.Initialize(project="isil-b-agri-project")
    # ⚠️ DO NOT call Base.metadata.create_all() - tables already exist!


# ─── PYDANTIC SCHEMAS ───────────────────────────────────────────────────────
class SamplingRequest(BaseModel):
    polygonPoints: list[list[float]]  # [[lat, lng], ...]
    cropType: str
    samplingMode: str  # "standard" | "economic"


class SamplingResponse(BaseModel):
    totalAreaHa: float
    soilData: dict
    zones: list[dict]
    strategy: dict
    mode: str
    savedParcelleId: Optional[int] = None
    savedSamplesCount: Optional[int] = None


# ─── ENDPOINTS ──────────────────────────────────────────────────────────────
@app.post("/api/sampling/run")
async def run_sampling(request: SamplingRequest):
    """Run sampling pipeline (calculations only, no save)"""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            run_sampling_pipeline,
            request.polygonPoints,
            request.cropType,
            request.samplingMode
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.post("/api/sampling/run-and-save", response_model=SamplingResponse)
async def run_and_save_sampling(
        request: SamplingRequest,
        farmer_id: int = 1,  # Default to test farmer; frontend can pass real ID
        db: Session = Depends(get_db)
):
    """Run sampling pipeline AND save results to Neon DB"""
    try:
        # 1. Run the calculation pipeline (same as /run endpoint)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            run_sampling_pipeline,
            request.polygonPoints,
            request.cropType,
            request.samplingMode
        )

        # 2. Prepare parcelle data for saving
        from shapely import wkt
        from shapely.geometry import Polygon

        # Convert polygon points to WKT for PostGIS
        coords = [[p[1], p[0]] for p in request.polygonPoints]  # [lng, lat]
        coords.append(coords[0])  # Close ring
        poly = Polygon(coords)
        location_wkt = poly.wkt  # e.g., "POLYGON((lng lat, ...))"

        # 3. Insert parcelle into existing table
        new_parcelle = Parcelle(
            farmerid=farmer_id,
            nom=f"Parcelle_{result['totalAreaHa']:.1f}ha_{request.cropType}",
            surface=result['totalAreaHa'],
            location=location_wkt  # GeoAlchemy2 auto-converts WKT to PostGIS
        )
        db.add(new_parcelle)
        db.flush()  # Get the new ID without committing yet

        # 4. Insert each sampling point into soil_samples table
        from datetime import date
        samples_created = 0

        for zone in result['zones']:
            for point in zone['points']:
                # point is [lat, lng] -> convert to PostGIS POINT WKT
                point_wkt = f"POINT({point[1]} {point[0]})"  # POINT(lng lat)

                sample = SoilSample(
                    parcelle_id=new_parcelle.id,
                    zone_name=zone['id'],
                    geometrie=point_wkt,
                    depth=20.0,  # Default depth in cm; can be made dynamic
                    date_echantillon=date.today(),
                    statut="à faire"  # Default status
                )
                db.add(sample)
                samples_created += 1

        # 5. Commit all changes
        db.commit()
        db.refresh(new_parcelle)

        # 6. Return response with saved IDs
        return {
            **result,
            "savedParcelleId": new_parcelle.id,
            "savedSamplesCount": samples_created
        }

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")


# Optional: Test endpoint to verify DB connection
@app.get("/api/db/test")
def test_db_connection(db: Session = Depends(get_db)):
    """Quick test: list farmers and parcelles count"""
    try:
        farmers = db.execute(select(Farmer)).scalars().all()
        parcelles_count = db.execute(select(func.count(Parcelle.id))).scalar()
        samples_count = db.execute(select(func.count(SoilSample.id))).scalar()

        return {
            "status": "connected",
            "farmers": [{"id": f.id, "name": f"{f.prenom} {f.nom}"} for f in farmers[:5]],
            "parcelles_count": parcelles_count,
            "soil_samples_count": samples_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB test failed: {str(e)}")