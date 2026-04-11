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

from Backend.services.sampling import run_sampling_pipeline
import asyncio

# ─── DATABASE SETUP ───────────────────────────────────────────────────────────
from sqlalchemy import create_engine, Column, Integer, String, Float, Numeric, Date, ForeignKey, DateTime, select, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from sqlalchemy.sql import func
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
    # Optional: Add this if you want to link to auth_user:
    # user_id = Column(Integer, ForeignKey("auth_user.id"), unique=True)


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
    # 1. Check if username or email already exists
    existing_auth = db.query(AuthUser).filter(
        (AuthUser.username == user.username) | (AuthUser.email == user.email)
    ).first()
    if existing_auth:
        raise HTTPException(400, "Username or email already exists")

    # 2. Check if farmer email already exists
    existing_farmer = db.query(Farmer).filter(Farmer.email == user.email).first()
    if existing_farmer:
        raise HTTPException(400, "Farmer with this email already exists")

    # 3. Hash password with Django's pbkdf2_sha256
    salt = secrets.token_urlsafe(16)
    iterations = 600000
    hash_bytes = hashlib.pbkdf2_hmac('sha256', user.password.encode(), salt.encode(), iterations, dklen=32)
    hash_db64 = base64.b64encode(hash_bytes).decode().strip('=')
    hashed_password = f"pbkdf2_sha256${iterations}${salt}${hash_db64}"

    try:
        # 4. Create AuthUser record
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

        # 5. Create Farmer profile record (auto-sync)
        new_farmer = Farmer(
            nom=user.last_name or "",
            prenom=user.first_name or "",
            email=user.email
        )
        db.add(new_farmer)
        db.flush()

        # 6. Commit both
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


# ─── PROTECTED SAMPLING ENDPOINT ──────────────────────────────────────────────
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

        # Ensure required keys exist
        result.setdefault('zones', [])
        result.setdefault('totalAreaHa', 0)

        # 2. Convert polygon to PostGIS WKT
        from shapely.geometry import Polygon
        coords = [[p[1], p[0]] for p in request.polygonPoints]  # [lng, lat]
        coords.append(coords[0])
        location_wkt = f"SRID=4326;{Polygon(coords).wkt}"

        # 3. ✅ LOOK UP the correct farmer.id by email
        farmer_record = db.query(Farmer).filter(Farmer.email == current_user.email).first()
        farmer_id_for_parcelle = farmer_record.id if farmer_record else None

        # 4. Create parcelle with CORRECT farmerid
        new_parcelle = Parcelle(
            user_id=current_user.id,  # ✅ Link to auth_user
            farmerid=farmer_id_for_parcelle,  # ✅ Link to farmer table (or None)
            nom=f"Parcelle_{result['totalAreaHa']:.1f}ha_{request.cropType}",
            surface=result['totalAreaHa'],
            location=location_wkt
        )
        db.add(new_parcelle)
        db.flush()

        # 5. Create soil samples
        from datetime import date
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

        # 6. Return response with ALL keys frontend expects
        return {
            "zones": result['zones'],
            "totalAreaHa": result['totalAreaHa'],
            "savedParcelleId": new_parcelle.id,
            "savedSamplesCount": samples_created,
            "user_id": current_user.id
        }

    except Exception as e:
        print(f"❌ ERROR in run_and_save: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()

        # Fallback: return zones even if DB fails (so frontend still works)
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