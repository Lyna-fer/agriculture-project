import os
import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import MetaData, Table, text

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from Backend.main import (
    BASE_DIR,
    DATABASE_URL,
    SQLITE_MODE,
    engine as local_engine,
    Base,
    create_sqlite_support_tables,
)

NEON_URL = os.getenv(
    "NEON_DATABASE_URL",
    "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

TABLES = [
    {
        "name": "auth_user",
        "query": "SELECT * FROM auth_user ORDER BY id",
        "truncate": "auth_user",
    },
    {
        "name": "farmer",
        "query": "SELECT * FROM farmer ORDER BY id",
        "truncate": "farmer",
    },
    {
        "name": "parcelles",
        "query": "SELECT id, farmerid, user_id, nom, surface, ST_AsText(location) AS location, group_id FROM parcelles ORDER BY id",
        "truncate": "parcelles",
    },
    {
        "name": "soil_samples",
        "query": "SELECT id, parcelle_id, zone_name, ST_AsText(geometrie) AS geometrie, depth, date_echantillon, statut FROM soil_samples ORDER BY id",
        "truncate": "soil_samples",
    },
    {
        "name": "zone_analysis",
        "query": "SELECT id, parcelle_id, user_id, zone_index, diag_mode, target_crop_id, soil_metrics, compatibility_score, analyzed_at FROM zone_analysis ORDER BY id",
        "truncate": "zone_analysis",
    },
    {
        "name": "crop_requirements",
        "query": "SELECT id, category, crop_name, ph_min, ph_max, ec_max, n_req, p_req, k_req, soil_type, om_min, active_lime_max, max_wind_kmh, wind_critical_start_days, pollution_accumulation_risk, name_ar, icon_filename, crop_slug, temp_min, temp_max, season, icon FROM crop_requirements ORDER BY id",
        "truncate": "crop_requirements",
    },
    {
        "name": "wind_expectations",
        "query": "SELECT month_id, month_name, avg_wind_speed_kmh, season FROM wind_expectations ORDER BY month_id",
        "truncate": "wind_expectations",
    },
    {
        "name": "economic_thresholds",
        "query": "SELECT id, max_ha, zones FROM economic_thresholds ORDER BY id",
        "truncate": "economic_thresholds",
    },
    {
        "name": "soil_data",
        "query": "SELECT id, parcelle_id, sat_ph, sat_ec, sat_temp, sat_soil_type, sat_soil_type_code, lab_ph, lab_ec, lab_nitrogen, lab_phosphorus, lab_potassium, lab_organic_matter, test_date, health_score, best_crop_suitability, recommended_crop_id, created_at, updated_at, source FROM soil_data ORDER BY id",
        "truncate": "soil_data",
    },
]


def normalize_row(row):
    normalized = {}
    for key, value in row.items():
        if isinstance(value, (dict, list)):
            normalized[key] = value
        elif isinstance(value, bytes):
            normalized[key] = value.decode("utf-8", errors="ignore")
        else:
            normalized[key] = value
    return normalized


def main() -> None:
    if not SQLITE_MODE:
        raise SystemExit("This script is meant to seed the local SQLite database only.")

    Base.metadata.create_all(bind=local_engine)
    create_sqlite_support_tables()
    metadata = MetaData()

    print(f"Local DB: {DATABASE_URL}")
    print(f"Source DB: {NEON_URL}")

    source_conn = psycopg2.connect(NEON_URL, cursor_factory=RealDictCursor)
    source_conn.autocommit = True

    try:
        with local_engine.begin() as local_conn:
            local_conn.execute(text("PRAGMA foreign_keys = OFF"))
            for table in TABLES:
                local_conn.execute(text(f"DELETE FROM {table['truncate']}"))

        with source_conn.cursor() as cur:
            for table in TABLES:
                print(f"Copying {table['name']}...")
                cur.execute(table["query"])
                rows = cur.fetchall()
                cleaned = [normalize_row(dict(row)) for row in rows]
                if not cleaned:
                    print(f"  -> no rows")
                    continue

                target_table = Table(table["name"], metadata, autoload_with=local_engine)
                with local_engine.begin() as local_conn:
                    local_conn.execute(target_table.insert(), cleaned)
                print(f"  -> {len(cleaned)} rows")

        with local_engine.begin() as local_conn:
            local_conn.execute(text("PRAGMA foreign_keys = ON"))

        print("Seed completed successfully.")
    finally:
        source_conn.close()


if __name__ == "__main__":
    main()
