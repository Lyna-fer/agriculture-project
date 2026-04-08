import psycopg2

try:
    # Update these with your real details!
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres", 
        password="Th1s1sPassword",
        host="localhost"
    )
    print("✅ Connection Successful!")
    conn.close()
except Exception as e:
    print("❌ Connection Failed:")
    print(e)