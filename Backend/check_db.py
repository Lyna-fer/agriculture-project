# Backend/check_db.py
# Run this to see your Neon DB structure
from sqlalchemy import create_engine, inspect, text
import os

# Your teammate's Neon URL (from their message)
NEON_URL = "postgresql://neondb_owner:npg_aH8xNI0goWJX@ep-jolly-dawn-allib500-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

engine = create_engine(NEON_URL)


def show_db_structure():
    print("🔍 Connecting to Neon DB...")
    with engine.connect() as conn:
        # List all tables
        result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = [row[0] for row in result]
        print(f"\n📋 Found {len(tables)} table(s): {tables}\n")

        # Show structure of each table
        for table in tables:
            print(f"\n{'=' * 60}")
            print(f"📦 TABLE: {table}")
            print('=' * 60)
            result = conn.execute(text(f"""
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = '{table}' AND table_schema = 'public'
                ORDER BY ordinal_position
            """))
            print(f"{'Column':<30} {'Type':<20} {'Nullable':<10} {'Default'}")
            print('-' * 70)
            for row in result:
                print(f"{row[0]:<30} {row[1]:<20} {row[2]:<10} {row[3] or '-'}")

            # Show first 3 rows as sample
            try:
                sample = conn.execute(text(f"SELECT * FROM {table} LIMIT 3")).fetchall()
                if sample:
                    print(f"\n📄 Sample rows ({len(sample)}):")
                    for i, row in enumerate(sample, 1):
                        print(f"  {i}. {row}")
            except Exception as e:
                print(f"\n⚠️ Could not fetch sample: {e}")


if __name__ == "__main__":
    show_db_structure()