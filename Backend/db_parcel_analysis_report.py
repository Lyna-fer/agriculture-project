from sqlalchemy import create_engine, text
import os

NEON_URL = os.getenv('DATABASE_URL') or "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(NEON_URL)

with engine.connect() as conn:
    print("\n=== Duplicate parcel names (name -> [ids]) ===\n")
    dup_sql = text("SELECT nom AS name, array_agg(id) AS ids, count(*) AS cnt FROM parcelles GROUP BY nom HAVING count(*) > 1 ORDER BY cnt DESC")
    dup_rows = conn.execute(dup_sql).mappings().all()
    if not dup_rows:
        print("No duplicate parcel names found.")
    else:
        for r in dup_rows:
            print(f"{r['name']} -> {r['ids']} (count={r['cnt']})")

    print("\n=== Parcels with analysis counts ===\n")
    sql = text("SELECT p.id, p.nom AS name, p.group_id, COALESCE(count(za.id),0) AS analysis_count FROM parcelles p LEFT JOIN zone_analysis za ON za.parcelle_id = p.id GROUP BY p.id, p.nom, p.group_id ORDER BY analysis_count DESC")
    rows = conn.execute(sql).mappings().all()
    for r in rows:
        print(f"id={r['id']:>4} name='{r['name']}' group_id={r['group_id']} analyses={r['analysis_count']}")

    print("\n=== zone_analysis sample rows (most recent 10) ===\n")
    sample_sql = text("SELECT id, parcelle_id, zone_index, analyzed_at FROM zone_analysis ORDER BY analyzed_at DESC LIMIT 10")
    sample = conn.execute(sample_sql).mappings().all()
    for r in sample:
        print(f"id={r['id']} parcelle_id={r['parcelle_id']} zone_index={r['zone_index']} analyzed_at={r['analyzed_at']}")

    print("\nDone.")
