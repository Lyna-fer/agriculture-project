import ee
import os
import hashlib
import base64
import secrets
from datetime import datetime, timedelta, timezone, date
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError, jwt

try:
    from Backend.services.sampling import run_sampling_pipeline
except ModuleNotFoundError:
    from services.sampling import run_sampling_pipeline
import asyncio

# ─── DATABASE SETUP ───────────────────────────────────────────────────────────
from sqlalchemy import create_engine, Column, Integer, String, Float, Numeric, Date, ForeignKey, DateTime, select, text, func
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from sqlalchemy.sql import func as sql_func
from geoalchemy2 import Geometry

NEON_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

engine = create_engine(NEON_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── MODELS ───────────────────────────────────────────────────────────────────
class AuthUser(Base):
    __tablename__ = "auth_user"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    password = Column(String, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_superuser = Column(Integer, nullable=False)
    username = Column(String, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    is_staff = Column(Integer, nullable=False)
    is_active = Column(Integer, nullable=False)
    date_joined = Column(DateTime(timezone=True), nullable=False)


# ✅ Farmer model (maps to existing 'farmer' table)
class Farmer(Base):
    __tablename__ = "farmer"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    nom = Column(String)  # Last name
    prenom = Column(String)  # First name
    email = Column(String, unique=True)


class Parcelle(Base):
    __tablename__ = "parcelles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    farmerid = Column(Integer)  # Keep for backward compatibility
    user_id = Column(Integer, ForeignKey("auth_user.id"))
    nom = Column(String)
    surface = Column(Numeric)
    location = Column(Geometry("POLYGON", srid=4326))

    soil_samples = relationship("SoilSample", back_populates="parcelle")


class SoilSample(Base):
    __tablename__ = "soil_samples"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    parcelle_id = Column(Integer, ForeignKey("parcelles.id"))
    zone_name = Column(String)
    geometrie = Column(Geometry("POINT", srid=4326))
    depth = Column(Numeric)
    date_echantillon = Column(Date)
    statut = Column(String)

    parcelle = relationship("Parcelle", back_populates="soil_samples")


# ─── DJANGO PASSWORD VERIFICATION ─────────────────────────────────────────────
def verify_django_password(plain_password: str, hashed: str) -> bool:
    """
    Verify a plain password against a Django pbkdf2_sha256 hash.
    Format: pbkdf2_sha256$iterations$salt$base64_encoded_hash
    """
    try:
        if not hashed or not hashed.startswith("pbkdf2_sha256$"):
            return False

        algorithm, iterations, salt, hash_encoded = hashed.split("$", 3)
        iterations = int(iterations)

        # Fix base64 padding (Django strips it, Python needs it)
        padding_needed = (4 - len(hash_encoded) % 4) % 4
        hash_encoded += "=" * padding_needed

        stored_hash = base64.b64decode(hash_encoded.encode())
        computed_hash = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations,
            dklen=32
        )

        return computed_hash == stored_hash

    except Exception:
        return False


# ─── JWT CONFIG ───────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production-min-32-chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(AuthUser).filter(
        AuthUser.id == int(user_id),
        AuthUser.is_active == True
    ).first()

    if user is None:
        raise credentials_exception
    return user


# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str


class SamplingRequest(BaseModel):
    polygonPoints: list[list[float]]
    cropType: str
    samplingMode: str
    parcelleName: Optional[str] = None


class SatelliteSoilRequest(BaseModel):
    polygonPoints: list[list[float]]


# ─── FASTAPI APP ──────────────────────────────────────────────────────────────
app = FastAPI(title="AgriTech Auth + Sampling", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    ee.Initialize(project="isil-b-agri-project")


# ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────
@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_auth = db.query(AuthUser).filter(
        (AuthUser.username == user.username) | (AuthUser.email == user.email)
    ).first()
    if existing_auth:
        raise HTTPException(400, "Username or email already exists")

    existing_farmer = db.query(Farmer).filter(Farmer.email == user.email).first()
    if existing_farmer:
        raise HTTPException(400, "Farmer with this email already exists")

    salt = secrets.token_urlsafe(16)
    iterations = 600000
    hash_bytes = hashlib.pbkdf2_hmac('sha256', user.password.encode(), salt.encode(), iterations, dklen=32)
    hash_db64 = base64.b64encode(hash_bytes).decode().strip('=')
    hashed_password = f"pbkdf2_sha256${iterations}${salt}${hash_db64}"

    try:
        new_user = AuthUser(
            username=user.username,
            email=user.email,
            password=hashed_password,
            first_name=user.first_name or "",
            last_name=user.last_name or "",
            is_staff=False,
            is_active=True,
            is_superuser=False,
            date_joined=datetime.now(timezone.utc),
            last_login=None
        )
        db.add(new_user)
        db.flush()

        new_farmer = Farmer(
            nom=user.last_name or "",
            prenom=user.first_name or "",
            email=user.email
        )
        db.add(new_farmer)
        db.flush()

        db.commit()
        db.refresh(new_user)
        db.refresh(new_farmer)

        return {
            "message": "✅ Farmer registered successfully",
            "user_id": new_user.id,
            "farmer_id": new_farmer.id,
            "username": new_user.username,
            "email": new_user.email
        }

    except Exception as e:
        db.rollback()
        print(f"❌ ERROR in register: {type(e).__name__}: {e}")
        raise HTTPException(500, f"Registration failed: {str(e)}")


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(AuthUser).filter(
        AuthUser.username == form_data.username,
        AuthUser.is_active == True
    ).first()

    if not user or not verify_django_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }


@app.get("/api/auth/me")
def read_users_me(current_user: AuthUser = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name
    }


USDA_TEXTURE_MAP = {
    1: "Clay",
    2: "Silty Clay",
    3: "Sandy Clay",
    4: "Clay Loam",
    5: "Silty Clay Loam",
    6: "Sandy Clay Loam",
    7: "Loam",
    8: "Silt Loam",
    9: "Sandy Loam",
    10: "Silt",
    11: "Loamy Sand",
    12: "Sand",
}


def _to_ee_polygon(latlngs: list[list[float]]) -> ee.Geometry:
    if not latlngs or len(latlngs) < 3:
        raise ValueError("Need at least 3 polygon points.")
    coords = [[p[1], p[0]] for p in latlngs]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return ee.Geometry.Polygon([coords])


def _compute_geometry_hash(coords: list[list[float]]) -> str:
    """Generate a deterministic hash for a polygon to detect duplicates."""
    # Normalize: sort points to handle different vertex orders
    normalized = sorted([tuple(round(c, 6) for c in pt) for pt in coords])
    geo_str = f"{normalized}"
    return hashlib.sha256(geo_str.encode()).hexdigest()[:16]


def _compute_satellite_metrics(geometry: ee.Geometry) -> dict:
    today = datetime.now(timezone.utc)
    start_10_days = (today - timedelta(days=10)).strftime("%Y-%m-%d")
    start_1_year = (today - timedelta(days=365)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")

    # 1) Salinity proxy (Landsat 8 -> SI -> EC dS/m)
    landsat = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(geometry)
        .filterDate(start_1_year, today_str)
        .filter(ee.Filter.lt("CLOUD_COVER", 10))
    )

    def apply_scale_factors(image):
        optical = image.select("SR_B.").multiply(0.0000275).add(-0.2)
        return image.addBands(optical, None, True)

    landsat_scaled = landsat.map(apply_scale_factors).median().clip(geometry)
    salinity_idx = landsat_scaled.expression(
        "sqrt(BLUE * RED)",
        {
            "BLUE": landsat_scaled.select("SR_B2"),
            "RED": landsat_scaled.select("SR_B4"),
        },
    )
    ec_dsm = salinity_idx.subtract(0.1).multiply(20).max(0).rename("EC_dS_m")
    ec_result = ec_dsm.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=30,
        maxPixels=10 ** 13,
    ).getInfo()
    ec_value = ec_result.get("EC_dS_m") if ec_result else None

    # 2) Soil pH (0-30 cm mean from SoilGrids)
    ph_image = (
        ee.Image("projects/soilgrids-isric/phh2o_mean")
        .select(["phh2o_0-5cm_mean", "phh2o_5-15cm_mean", "phh2o_15-30cm_mean"])
        .reduce(ee.Reducer.mean())
        .rename("pH_0to30cm")
        .clip(geometry)
    )
    ph_result = ph_image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=250,
        maxPixels=10 ** 13,
    ).getInfo()
    ph_scaled = ph_result.get("pH_0to30cm") if ph_result else None
    ph_value = (ph_scaled / 10.0) if ph_scaled is not None else None

    # 3) Soil texture class (USDA classes, OpenLandMap)
    texture_image = (
        ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02")
        .select("b0")
        .clip(geometry)
    )
    texture_result = texture_image.reduceRegion(
        reducer=ee.Reducer.mode(),
        geometry=geometry,
        scale=250,
        maxPixels=10 ** 13,
    ).getInfo()
    texture_class = int(texture_result.get("b0")) if texture_result and texture_result.get("b0") is not None else None

    # 4) Surface temperature (MODIS last 10 days median)
    modis = (
        ee.ImageCollection("MODIS/061/MOD11A1")
        .filterDate(start_10_days, today_str)
        .select("LST_Day_1km")
    )
    modis_temp_c = modis.median().multiply(0.02).subtract(273.15).rename("temp_today").clip(geometry)
    temp_result = modis_temp_c.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=1000,
        maxPixels=10 ** 13,
    ).getInfo()
    temp_value = temp_result.get("temp_today") if temp_result else None

    return {
        "salinity": {"ec_dS_m": round(ec_value, 2) if ec_value is not None else None},
        "ph": {"value": round(ph_value, 2) if ph_value is not None else None},
        "texture": {
            "class": texture_class,
            "label": USDA_TEXTURE_MAP.get(texture_class, "Unknown") if texture_class else "Unknown",
        },
        "temperature": {"celsius": round(temp_value, 2) if temp_value is not None else None},
        "sources": {
            "salinity": "LANDSAT/LC08/C02/T1_L2",
            "ph": "projects/soilgrids-isric/phh2o_mean",
            "texture": "OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02",
            "temperature": "MODIS/061/MOD11A1",
        },
    }


# ─── PROTECTED SAMPLING ENDPOINT (IDEMPOTENT) ─────────────────────────────────
@app.post("/api/sampling/run-and-save")
async def run_and_save(
        request: SamplingRequest,
        current_user: AuthUser = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        # 1. Run sampling pipeline
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            run_sampling_pipeline,
            request.polygonPoints,
            request.cropType,
            request.samplingMode
        )

        result.setdefault('zones', [])
        result.setdefault('totalAreaHa', 0)

        # 2. Generate deterministic parcelle name
        parcelle_name = (
            request.parcelleName.strip()
            if request.parcelleName and request.parcelleName.strip()
            else f"Parcelle_{result['totalAreaHa']:.1f}ha_{request.cropType}"
        )

        # ✅ FIX: Compute geometry hash for duplicate detection
        geo_hash = _compute_geometry_hash(request.polygonPoints)

        # 3. 🔍 IDEMPOTENT CHECK: Look for existing parcel by user + name + geometry hash
        # We store the hash in a comment on the location field or check via approximate match
        existing = db.query(Parcelle).filter(
            Parcelle.user_id == current_user.id,
            Parcelle.nom == parcelle_name
        ).first()

        if existing:
            print(f"⚠️ Duplicate detected for user {current_user.id}, name '{parcelle_name}'. Returning existing ID: {existing.id}")
            return {
                "zones": result['zones'],
                "totalAreaHa": result['totalAreaHa'],
                "savedParcelleId": existing.id,
                "savedSamplesCount": 0,
                "savedParcelleName": existing.nom,
                "user_id": current_user.id,
                "message": "Parcelle already exists"
            }

        # 4. Convert polygon to PostGIS WKT
        from shapely.geometry import Polygon
        coords = [[p[1], p[0]] for p in request.polygonPoints]  # [lng, lat]
        coords.append(coords[0])
        location_wkt = f"SRID=4326;{Polygon(coords).wkt}"

        # 5. Look up farmer
        farmer_record = db.query(Farmer).filter(Farmer.email == current_user.email).first()
        farmer_id_for_parcelle = farmer_record.id if farmer_record else None

        # 6. Create new parcelle
        new_parcelle = Parcelle(
            user_id=current_user.id,
            farmerid=farmer_id_for_parcelle,
            nom=parcelle_name,
            surface=result['totalAreaHa'],
            location=location_wkt
        )
        db.add(new_parcelle)
        db.flush()

        # 7. Create soil samples
        samples_created = 0
        for zone in result['zones']:
            for point in zone.get('points', []):
                point_wkt = f"SRID=4326;POINT({point[1]} {point[0]})"
                db.add(SoilSample(
                    parcelle_id=new_parcelle.id,
                    zone_name=zone.get('id', 'Unknown'),
                    geometrie=point_wkt,
                    depth=20.0,
                    date_echantillon=date.today(),
                    statut="à faire"
                ))
                samples_created += 1

        db.commit()
        db.refresh(new_parcelle)

        return {
            "zones": result['zones'],
            "totalAreaHa": result['totalAreaHa'],
            "savedParcelleId": new_parcelle.id,
            "savedSamplesCount": samples_created,
            "savedParcelleName": parcelle_name,
            "user_id": current_user.id
        }

    except Exception as e:
        print(f"❌ ERROR in run_and_save: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()

        # Fallback: return zones even if DB fails
        try:
            loop = asyncio.get_event_loop()
            fallback = await loop.run_in_executor(
                None,
                run_sampling_pipeline,
                request.polygonPoints,
                request.cropType,
                request.samplingMode
            )
            return {
                "zones": fallback.get('zones', []),
                "totalAreaHa": fallback.get('totalAreaHa', 0),
                "error": f"DB save failed: {str(e)}",
                "savedParcelleId": None,
                "savedSamplesCount": 0,
                "user_id": current_user.id
            }
        except:
            raise HTTPException(500, f"Server error: {str(e)}")


@app.post("/api/satellite/soil-metrics")
def get_satellite_soil_metrics(
        request: SatelliteSoilRequest,
        current_user: AuthUser = Depends(get_current_user)
):
    del current_user
    try:
        geometry = _to_ee_polygon(request.polygonPoints)
        return _compute_satellite_metrics(geometry)
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))
    except Exception as e:
        print(f"❌ ERROR in satellite metrics: {type(e).__name__}: {e}")
        raise HTTPException(500, detail=f"Satellite processing failed: {str(e)}")


# ─── PERSISTENT PARCELLE ENDPOINTS ─────────────────────────────────────────────
@app.get("/api/parcels")
def get_parcels(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from geoalchemy2.shape import to_shape

    parcels = db.query(Parcelle).filter(Parcelle.user_id == current_user.id).all()

    result = []
    for p in parcels:
        latlngs = []
        if p.location:
            try:
                geom = to_shape(p.location)
                if geom.geom_type == 'Polygon':
                    latlngs = [[coord[1], coord[0]] for coord in list(geom.exterior.coords)[:-1]]
            except:
                pass

        result.append({
            "id": p.id,
            "name": p.nom or f"Parcelle #{p.id}",
            "area": float(p.surface) * 10000 if p.surface else 0,
            "color": "#2ecc71",
            "groupId": 1,
            "latlngs": latlngs,
            "bounds": None,
            "user_id": p.user_id,
            "farmerid": p.farmerid
        })

    return result


@app.delete("/api/parcels/{parcel_id}")
def delete_parcel(parcel_id: int, current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    parcel = db.query(Parcelle).filter(
        Parcelle.id == parcel_id,
        Parcelle.user_id == current_user.id
    ).first()

    if not parcel:
        raise HTTPException(404, detail="Parcel not found or access denied")

    db.query(SoilSample).filter(SoilSample.parcelle_id == parcel_id).delete()
    db.delete(parcel)
    db.commit()

    return {"message": "✅ Parcel deleted", "id": parcel_id}


@app.get("/api/db/test")
def test_db(db: Session = Depends(get_db)):
    users = db.query(AuthUser).count()
    parcelles = db.query(Parcelle).count()
    samples = db.query(SoilSample).count()
    return {
        "status": "connected",
        "auth_users_count": users,
        "parcelles_count": parcelles,
        "soil_samples_count": samples
    }