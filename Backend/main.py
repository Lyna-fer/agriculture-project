import ee
import os
import math
import hashlib
import base64
import secrets
from datetime import datetime, timedelta, timezone, date
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import Response
from pydantic import BaseModel
from jose import JWTError, jwt
import httpx

try:
    from Backend.services.sampling import run_sampling_pipeline
except ModuleNotFoundError:
    from services.sampling import run_sampling_pipeline
try:
    from Backend.services.kml_export import build_sampling_kml
except ModuleNotFoundError:
    from services.kml_export import build_sampling_kml
import asyncio

from sqlalchemy import create_engine, Column, Integer, String, Float, Numeric, Date, ForeignKey, DateTime, select, text, func, JSON

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
    group_id = Column(Integer, nullable=True, default=1)  # ✅ NEW
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

class ZoneAnalysis(Base):
    __tablename__ = "zone_analysis"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    parcelle_id = Column(Integer, ForeignKey("parcelles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=False)
    zone_index = Column(Integer, nullable=False) 
    diag_mode = Column(String(50), nullable=False) 
    target_crop_id = Column(String(255), nullable=True) 
    soil_metrics = Column(JSON, nullable=False)
    compatibility_score = Column(Float, nullable=True)
    analyzed_at = Column(DateTime(timezone=True), default=sql_func.now())

    parcelle = relationship("Parcelle", backref="analyses")

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
    groupId: Optional[int] = None  # ✅ NEW
    parcelleId: Optional[int] = None


class ParcelleCreateRequest(BaseModel):
    name: str
    polygonPoints: list[list[float]]
    areaHa: Optional[float] = None
    groupId: Optional[int] = None


class SatelliteSoilRequest(BaseModel):
    polygonPoints: list[list[float]]


class WeatherParcelRequest(BaseModel):
    polygonPoints: list[list[float]]


class KmlExportRequest(BaseModel):
    zones: list[dict]
    parcelleName: Optional[str] = None


class CropRequirementOut(BaseModel):
    id: str
    nameEn: str
    nameAr: Optional[str] = None
    emoji: Optional[str] = None
    ph: list[float]
    ec: float
    tempMin: float
    tempMax: float
    nReq: int
    pReq: int
    kReq: int
    soilType: str
    omMin: float
    activeLimeMax: float
    maxWindKmh: int
    windCriticalStartDays: int
    pollutionAccumulationRisk: str
    dbId: int
    category: str
    crop_name: str
    season: Optional[str] = None  # ✅ ADD THIS

class WindExpectationOut(BaseModel):
    monthId: int
    monthName: Optional[str] = None
    avgWindSpeedKmh: float
    season: Optional[str] = None


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


def _compute_polygon_centroid(latlngs: list[list[float]]) -> tuple[float, float]:
    if not latlngs or len(latlngs) < 3:
        raise HTTPException(400, "Need at least 3 polygon points.")

    coords = [[float(point[1]), float(point[0])] for point in latlngs]
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    try:
        from shapely.geometry import Polygon

        centroid = Polygon(coords).centroid
        if math.isfinite(centroid.y) and math.isfinite(centroid.x):
            return float(centroid.y), float(centroid.x)
    except Exception:
        pass

    lat = sum(float(point[0]) for point in latlngs) / len(latlngs)
    lng = sum(float(point[1]) for point in latlngs) / len(latlngs)
    return lat, lng


def _weather_code_meta(code: int | float | None) -> dict:
    weather_map = {
        0: {"label": "Clear sky", "icon": "☀️"},
        1: {"label": "Mostly clear", "icon": "🌤️"},
        2: {"label": "Partly cloudy", "icon": "⛅"},
        3: {"label": "Overcast", "icon": "☁️"},
        45: {"label": "Fog", "icon": "🌫️"},
        48: {"label": "Rime fog", "icon": "🌫️"},
        51: {"label": "Light drizzle", "icon": "🌦️"},
        53: {"label": "Drizzle", "icon": "🌦️"},
        55: {"label": "Dense drizzle", "icon": "🌧️"},
        61: {"label": "Light rain", "icon": "🌦️"},
        63: {"label": "Rain", "icon": "🌧️"},
        65: {"label": "Heavy rain", "icon": "⛈️"},
        71: {"label": "Light snow", "icon": "🌨️"},
        73: {"label": "Snow", "icon": "🌨️"},
        75: {"label": "Heavy snow", "icon": "❄️"},
        80: {"label": "Rain showers", "icon": "🌦️"},
        81: {"label": "Rain showers", "icon": "🌧️"},
        82: {"label": "Violent showers", "icon": "⛈️"},
        95: {"label": "Thunderstorm", "icon": "⛈️"},
        96: {"label": "Storm with hail", "icon": "⛈️"},
        99: {"label": "Severe storm", "icon": "⛈️"},
    }
    return weather_map.get(int(code) if code is not None else -1, {"label": "Weather update", "icon": "🌤️"})


async def _fetch_weather_payload(latitude: float, longitude: float) -> dict:
    params = {
        "latitude": str(latitude),
        "longitude": str(longitude),
        "current": "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
        "past_days": "3",
        "forecast_days": "3",
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        response.raise_for_status()
        return response.json()


def _build_weather_response(payload: dict, latitude: float, longitude: float) -> dict:
    daily = payload.get("daily") or {}
    current = payload.get("current") or {}
    today = datetime.now(timezone.utc).date().isoformat()
    dates = list(daily.get("time") or [])
    rain = list(daily.get("precipitation_sum") or [])
    probs = list(daily.get("precipitation_probability_max") or [])
    max_temps = list(daily.get("temperature_2m_max") or [])
    min_temps = list(daily.get("temperature_2m_min") or [])
    wind_max = list(daily.get("wind_speed_10m_max") or [])
    codes = list(daily.get("weather_code") or [])

    recent_indexes = [item for item in enumerate(dates) if item[1] < today]
    forecast_indexes = [item for item in enumerate(dates) if item[1] >= today]
    next_rain_day = next(
        (
            item for item in forecast_indexes
            if float(rain[item[0]] or 0) > 0.5 or float(probs[item[0]] or 0) >= 40
        ),
        None,
    )
    today_index = next((index for index, value in enumerate(dates) if value == today), -1)
    current_code = current.get("weather_code")
    if current_code is None and today_index >= 0:
      current_code = codes[today_index]
    current_meta = _weather_code_meta(current_code)

    return {
        "source": "open-meteo",
        "observedAt": current.get("time") or datetime.now(timezone.utc).isoformat(),
        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "currentTemp": current.get("temperature_2m"),
        "currentLabel": current_meta["label"],
        "currentIcon": current_meta["icon"],
        "currentWindKmh": current.get("wind_speed_10m"),
        "currentHumidity": current.get("relative_humidity_2m"),
        "currentRainMm": current.get("precipitation"),
        "todayMaxTemp": float(max_temps[today_index]) if today_index >= 0 and max_temps[today_index] is not None else None,
        "todayRainMm": float(rain[today_index]) if today_index >= 0 and rain[today_index] is not None else 0,
        "recentRainMm": sum(float(rain[index] or 0) for index, _ in recent_indexes),
        "maxRecentRainMm": max((float(rain[index] or 0) for index, _ in recent_indexes), default=0),
        "nextRainDate": next_rain_day[1] if next_rain_day else None,
        "nextRainMm": float(rain[next_rain_day[0]] or 0) if next_rain_day else 0,
        "nextRainProbability": float(probs[next_rain_day[0]] or 0) if next_rain_day else 0,
        "forecastSummary": [
            {
                "date": date_value,
                "rain": float(rain[index] or 0),
                "probability": float(probs[index] or 0),
                "maxTemp": float(max_temps[index] or 0),
                "minTemp": float(min_temps[index] or 0),
                "windMaxKmh": float(wind_max[index] or 0),
                **_weather_code_meta(codes[index]),
            }
            for index, date_value in forecast_indexes[:3]
        ],
    }


@app.post("/api/weather/parcel")
async def get_parcel_weather(request: WeatherParcelRequest):
    try:
        latitude, longitude = _compute_polygon_centroid(request.polygonPoints)
        payload = await _fetch_weather_payload(latitude, longitude)
        return _build_weather_response(payload, latitude, longitude)
    except HTTPException:
        raise
    except httpx.HTTPError as error:
        raise HTTPException(502, detail=f"Weather service unavailable: {str(error)}")
    except Exception as error:
        raise HTTPException(500, detail=f"Weather lookup failed: {str(error)}")


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

    # 5) Organic matter proxy (Sentinel-2 vegetation + bare soil signal)
    # OM is not directly observable from satellite imagery; this is a calibrated proxy.
    sentinel2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geometry)
        .filterDate(start_1_year, today_str)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    )

    def mask_s2_clouds(image):
        scl = image.select("SCL")
        cloud_mask = (
            scl.neq(3)
            .And(scl.neq(7))
            .And(scl.neq(8))
            .And(scl.neq(9))
            .And(scl.neq(10))
            .And(scl.neq(11))
        )
        return image.updateMask(cloud_mask)

    def scale_s2(image):
        optical = image.select(["B.*"]).multiply(0.0001)
        return image.addBands(optical, None, True)

    s2_median = sentinel2.map(mask_s2_clouds).map(scale_s2).median().clip(geometry)
    ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndmi = s2_median.normalizedDifference(["B8", "B11"]).rename("NDMI")
    bsi = s2_median.expression(
        "((swir + red) - (nir + blue)) / ((swir + red) + (nir + blue))",
        {
            "swir": s2_median.select("B11"),
            "red": s2_median.select("B4"),
            "nir": s2_median.select("B8"),
            "blue": s2_median.select("B2"),
        },
    ).rename("BSI")

    om_proxy = (
        ndvi.multiply(4.5)
        .add(ndmi.multiply(1.8))
        .subtract(bsi.multiply(3.2))
        .add(1.2)
        .clamp(0.4, 7.5)
        .rename("OM_percent")
    )
    om_result = om_proxy.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=20,
        maxPixels=10 ** 13,
    ).getInfo()
    om_value = om_result.get("OM_percent") if om_result else None

    def organic_matter_level(value: float | None) -> str:
        if value is None:
            return "moyen"
        if value < 1:
            return "tres-bas"
        if value < 2:
            return "bas"
        if value < 4:
            return "moyen"
        if value < 6:
            return "bon"
        return "excellent"

    return {
        "salinity": {"ec_dS_m": round(ec_value, 2) if ec_value is not None else None},
        "ph": {"value": round(ph_value, 2) if ph_value is not None else None},
        "organicMatter": {
            "value": round(om_value, 2) if om_value is not None else None,
            "level": organic_matter_level(om_value),
        },
        "texture": {
            "class": texture_class,
            "label": USDA_TEXTURE_MAP.get(texture_class, "Unknown") if texture_class else "Unknown",
        },
        "temperature": {"celsius": round(temp_value, 2) if temp_value is not None else None},
        "sources": {
            "salinity": "LANDSAT/LC08/C02/T1_L2",
            "ph": "projects/soilgrids-isric/phh2o_mean",
            "organicMatter": "COPERNICUS/S2_SR_HARMONIZED",
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
        if not request.parcelleId:
            raise HTTPException(400, "Parcelle must be saved before generating sampling guide")

        parcelle_record = db.query(Parcelle).filter(
            Parcelle.id == request.parcelleId,
            Parcelle.user_id == current_user.id
        ).first()

        if not parcelle_record:
            raise HTTPException(404, "Parcelle not found")

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

        parcelle_name = parcelle_record.nom or f"Parcelle_{result['totalAreaHa']:.1f}ha_{request.cropType}"

        # Keep the existing parcel geometry metadata in sync with the sampling request.
        if request.groupId:
            parcelle_record.group_id = request.groupId

        # Replace previous samples for this parcel so repeated generation does not duplicate them.
        db.query(SoilSample).filter(SoilSample.parcelle_id == parcelle_record.id).delete()

        # 2. Create soil samples for the saved parcel
        samples_created = 0
        for zone in result['zones']:
            for point in zone.get('points', []):
                point_wkt = f"SRID=4326;POINT({point[1]} {point[0]})"
                db.add(SoilSample(
                    parcelle_id=parcelle_record.id,
                    zone_name=zone.get('id', 'Unknown'),
                    geometrie=point_wkt,
                    depth=20.0,
                    date_echantillon=date.today(),
                    statut="à faire"
                ))
                samples_created += 1

        db.commit()

        return {
            "zones": result['zones'],
            "totalAreaHa": result['totalAreaHa'],
            "savedParcelleId": parcelle_record.id,
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


@app.post("/api/parcels")
def create_parcel(
        request: ParcelleCreateRequest,
        current_user: AuthUser = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if not request.name or not request.name.strip():
        raise HTTPException(400, detail="Parcel name is required")
    if not request.polygonPoints or len(request.polygonPoints) < 3:
        raise HTTPException(400, detail="Parcel geometry is required")

    parcelle_name = request.name.strip()
    existing = db.query(Parcelle).filter(
        Parcelle.user_id == current_user.id,
        Parcelle.nom == parcelle_name
    ).first()
    if existing:
        from geoalchemy2.shape import to_shape

        latlngs = []
        if existing.location:
          try:
              geom = to_shape(existing.location)
              if geom.geom_type == 'Polygon':
                  latlngs = [[coord[1], coord[0]] for coord in list(geom.exterior.coords)[:-1]]
          except:
              pass

        return {
            "id": existing.id,
            "name": existing.nom or f"Parcelle #{existing.id}",
            "area": float(existing.surface) * 10000 if existing.surface else 0,
            "color": "#2ecc71",
            "groupId": existing.group_id or request.groupId or 1,
            "latlngs": latlngs,
            "bounds": None,
            "user_id": existing.user_id,
            "farmerid": existing.farmerid
        }

    from shapely.geometry import Polygon

    coords = [[p[1], p[0]] for p in request.polygonPoints]
    coords.append(coords[0])
    location_wkt = f"SRID=4326;{Polygon(coords).wkt}"

    farmer_record = db.query(Farmer).filter(Farmer.email == current_user.email).first()
    farmer_id_for_parcelle = farmer_record.id if farmer_record else None

    new_parcelle = Parcelle(
        user_id=current_user.id,
        farmerid=farmer_id_for_parcelle,
        nom=parcelle_name,
        surface=request.areaHa or 0,
        location=location_wkt,
        group_id=request.groupId or 1
    )
    db.add(new_parcelle)
    db.commit()
    db.refresh(new_parcelle)

    return {
        "id": new_parcelle.id,
        "name": new_parcelle.nom,
        "area": float(new_parcelle.surface) * 10000 if new_parcelle.surface else 0,
        "color": "#2ecc71",
        "groupId": new_parcelle.group_id or 1,
        "latlngs": request.polygonPoints,
        "bounds": None,
        "user_id": new_parcelle.user_id,
        "farmerid": new_parcelle.farmerid
    }


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


@app.post("/api/sampling/export-kml")
def export_sampling_kml(
        request: KmlExportRequest,
        current_user: AuthUser = Depends(get_current_user)
):
    del current_user
    try:
        kml = build_sampling_kml(request.zones, request.parcelleName or "Sampling points")
        safe_name = (request.parcelleName or "sampling-points").strip().replace(" ", "-") or "sampling-points"
        return Response(
            content=kml,
            media_type="application/vnd.google-earth.kml+xml",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.kml"'
            },
        )
    except Exception as e:
        print(f"❌ ERROR in KML export: {type(e).__name__}: {e}")
        raise HTTPException(500, detail=f"KML export failed: {str(e)}")


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
            "groupId": p.group_id or 1,  # ✅ DYNAMIC instead of hardcoded 1
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
    db.query(ZoneAnalysis).filter(ZoneAnalysis.parcelle_id == parcel_id).delete()
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


@app.get("/api/crops/requirements", response_model=list[CropRequirementOut])
def get_crop_requirements(groupId: Optional[int] = None, db: Session = Depends(get_db)):
    category_map = {1: "vegetables", 2: "cereals", 3: "trees"}
    category = category_map.get(groupId) if groupId is not None else None

    where_clause = "WHERE category = :category" if category else ""
    params = {"category": category} if category else {}

    # temp_min/temp_max are optional DB columns; fallback keeps endpoint resilient.
    query = text(f"""
        SELECT
            id,
            category,
            crop_name,
            ph_min,
            ph_max,
            ec_max,
            n_req,
            p_req,
            k_req,
            soil_type,
            om_min,
            active_lime_max,
            max_wind_kmh,
            wind_critical_start_days,
            pollution_accumulation_risk,
            name_ar,
            icon_filename,
            season,
            crop_slug,
            COALESCE(temp_min, 10) AS temp_min,
            COALESCE(temp_max, 30) AS temp_max
        FROM crop_requirements
        {where_clause}
        ORDER BY id
    """)

    rows = db.execute(query, params).mappings().all()

    return [
        {
            "id": row["crop_slug"] or row["crop_name"].lower().replace(" ", "_"),
            "nameEn": row["crop_name"],
            "nameAr": row["name_ar"],
            "emoji": row["icon_filename"],
            "ph": [float(row["ph_min"]), float(row["ph_max"])],
            "ec": float(row["ec_max"]),
            "tempMin": float(row["temp_min"]),
            "tempMax": float(row["temp_max"]),
            "nReq": int(row["n_req"]),
            "pReq": int(row["p_req"]),
            "kReq": int(row["k_req"]),
            "soilType": row["soil_type"],
            "omMin": float(row["om_min"]),
            "activeLimeMax": float(row["active_lime_max"]),
            "maxWindKmh": int(row["max_wind_kmh"]),
            "windCriticalStartDays": int(row["wind_critical_start_days"]),
            "pollutionAccumulationRisk": row["pollution_accumulation_risk"],
            "season": row["season"],
            "dbId": int(row["id"]),
            "category": row["category"],
            "crop_name": row["crop_name"],
        }
        for row in rows
    ]


@app.get("/api/wind-expectations", response_model=list[WindExpectationOut])
def get_wind_expectations(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            month_id,
            month_name,
            avg_wind_speed_kmh,
            season
        FROM wind_expectations
        ORDER BY month_id
    """)).mappings().all()

    return [
        {
            "monthId": int(row["month_id"]),
            "monthName": row["month_name"],
            "avgWindSpeedKmh": float(row["avg_wind_speed_kmh"]),
            "season": row["season"],
        }
        for row in rows
    ]
    
    from pydantic import BaseModel
from typing import Any

# Pydantic schema to receive the data from React
class SaveZoneAnalysisRequest(BaseModel):
    parcelleId: int
    zoneIndex: int
    diagMode: str
    targetCropId: Optional[str] = None
    soilMetrics: Any  # Accepts the entire 'st' JSON object
    compatibilityScore: Optional[float] = None


# Replace your existing POST /api/analysis/save-zone with this:
# Replace your existing POST /api/analysis/save-zone with this:
@app.post("/api/analysis/save-zone")
def save_zone_analysis(
        request: SaveZoneAnalysisRequest,
        current_user: AuthUser = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        parcelle = db.query(Parcelle).filter(
            Parcelle.id == request.parcelleId,
            Parcelle.user_id == current_user.id
        ).first()
        if not parcelle:
            raise HTTPException(status_code=404, detail="Parcelle not found")

        new_analysis = ZoneAnalysis(
            parcelle_id=parcelle.id,
            user_id=current_user.id,
            zone_index=request.zoneIndex,
            diag_mode=request.diagMode,
            target_crop_id=request.targetCropId,
            soil_metrics=request.soilMetrics,
            compatibility_score=request.compatibilityScore,
        )
        db.add(new_analysis)
        db.commit()
        db.refresh(new_analysis)

        # ENFORCER: Keep only the 2 most recent analyses for this zone
        recent_ids = db.query(ZoneAnalysis.id).filter(
            ZoneAnalysis.parcelle_id == parcelle.id,
            ZoneAnalysis.zone_index == request.zoneIndex
        ).order_by(ZoneAnalysis.analyzed_at.desc()).limit(2).all()

        keep_ids = [row.id for row in recent_ids]
        db.query(ZoneAnalysis).filter(
            ZoneAnalysis.parcelle_id == parcelle.id,
            ZoneAnalysis.zone_index == request.zoneIndex,
            ~ZoneAnalysis.id.in_(keep_ids)
        ).delete(synchronize_session=False)
        db.commit()

        # Return the saved analysis for immediate frontend sync
        return {
            "message": "Zone analysis saved successfully",
            "analysis": {
                "id": new_analysis.id,
                "diagMode": new_analysis.diag_mode,
                "targetCropId": new_analysis.target_crop_id,
                "soilMetrics": new_analysis.soil_metrics,
                "compatibilityScore": new_analysis.compatibility_score,
                "analyzedAt": new_analysis.analyzed_at.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save analysis: {str(e)}")


# Replace your existing GET /api/analysis/parcel/{parcelle_id} with this:
@app.get("/api/analysis/parcel/{parcelle_id}")
def get_parcel_analyses(
        parcelle_id: int,
        current_user: AuthUser = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    parcelle = db.query(Parcelle).filter(
        Parcelle.id == parcelle_id,
        Parcelle.user_id == current_user.id
    ).first()
    if not parcelle:
        raise HTTPException(status_code=404, detail="Parcelle not found")

    # Fetch all, ordered newest first
    analyses = db.query(ZoneAnalysis).filter(
        ZoneAnalysis.parcelle_id == parcelle_id
    ).order_by(
        ZoneAnalysis.zone_index.asc(),
        ZoneAnalysis.analyzed_at.desc()
    ).all()

    results = {}
    for row in analyses:
        zone_str = f"zone_{row.zone_index}"
        if zone_str not in results:
            results[zone_str] = []
        # Enforce max 2 per zone in the response
        if len(results[zone_str]) < 2:
            results[zone_str].append({
                "id": row.id,
                "diagMode": row.diag_mode,
                "targetCropId": row.target_crop_id,
                "soilMetrics": row.soil_metrics,
                "compatibilityScore": row.compatibility_score,
                "analyzedAt": row.analyzed_at.isoformat()
            })

    # Format explicitly for frontend: { "zone_X": { "current": {...}, "previous": {... or null} } }
    formatted_results = {}
    for zone_key, zone_arr in results.items():
        formatted_results[zone_key] = {
            "current": zone_arr[0] if len(zone_arr) > 0 else None,
            "previous": zone_arr[1] if len(zone_arr) > 1 else None
        }

    return formatted_results