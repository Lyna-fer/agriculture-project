from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List  # <-- Crucial for lists of points!
import psycopg2
import json
import requests
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# 1. Define the Zone payload
class ZonePayload(BaseModel):
    zone_name: str
    points: List[List[float]] # Expects [lat, lng] coordinates

# 2. Main Request Model
class SamplingRequest(BaseModel):
    farmer_id: int
    parcelle_name: str
    surface_ha: float
    polygon_geojson: dict
    crop_name: str
    # Add Field(min_length=1) to ensure at least one zone is sent!
    zones: List[ZonePayload] = Field(min_length=1, description="Must provide at least one zone")

# Neon URL
NEON_URL = "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

@app.post("/api/generate-samples")
def generate_samples(req: SamplingRequest):
    # --- THE TRUE OCEAN TEST ---
    # Take the first point of the drawn polygon
    first_point = req.polygon_geojson.get("coordinates", [[]])[0][0]
    lng = first_point[0]
    lat = first_point[1]

    try:
        # Ask OpenStreetMap what is at these coordinates (zoom=3 checks at the country level)
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&zoom=3"
        headers = {'User-Agent': 'Agri-DSS-App'}
        res = requests.get(url, headers=headers, timeout=3).json()
        
        # If OSM says "Unable to geocode", it means it's in the middle of the ocean!
        if "error" in res and "Unable to geocode" in res["error"]:
            raise HTTPException(
                status_code=400, 
                detail="Plouf ! 🌊 Erreur géographique: La parcelle se trouve dans l'océan !"
            )
    except requests.exceptions.RequestException:
        # If the OSM API is temporarily down, we just pass so the app doesn't break
        pass
    conn = None
    try:
        conn = psycopg2.connect(NEON_URL)
        cursor = conn.cursor()

        geojson_str = json.dumps(req.polygon_geojson)

        # 3. Save the main outer boundary of the farm
        cursor.execute("""
            INSERT INTO Parcelles (FarmerID, Nom, Surface, Location)
            VALUES (%s, %s, %s, ST_GeomFromGeoJSON(%s))
            RETURNING ID;
        """, (req.farmer_id, req.parcelle_name, req.surface_ha, geojson_str))
        
        new_parcelle_id = cursor.fetchone()[0]

        # 4. Loop through React's zones and save the EXACT zigzag points
        saved_points_count = 0
        for zone in req.zones:
            for pt in zone.points:
                lat = pt[0]
                lng = pt[1]
                # PostGIS strictly uses ST_MakePoint(Longitude, Latitude)
                cursor.execute("""
                    INSERT INTO Soil_Samples (Parcelle_ID, Zone_Name, Geometrie, Depth, Date_echantillon, Statut)
                    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 20.0, CURRENT_DATE, 'à faire')
                """, (new_parcelle_id, zone.zone_name, lng, lat))
                saved_points_count += 1
        
        # 5. Commit all saves to the cloud
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "status": "success",
            "parcelle_id": new_parcelle_id,
            "message": f"Saved {saved_points_count} points across {len(req.zones)} zones."
        }

    except Exception as e:
        if conn: 
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))