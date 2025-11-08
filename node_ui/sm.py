import sqlite3

# Connect to the database (it will create it if it doesn't exist)
conn = sqlite3.connect("auth.db")
cursor = conn.cursor()

# 1️⃣ List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables in database:", tables)

# 2️⃣ Show schema of each table
for table in tables:
    table_name = table[0]
    print(f"\nSchema of table '{table_name}':")
    cursor.execute(f"PRAGMA table_info({table_name});")
    schema = cursor.fetchall()
    for col in schema:
        print(col)

# 3️⃣ Fetch all data from each table
for table in tables:
    table_name = table[0]
    print(f"\nData in table '{table_name}':")
    cursor.execute(f"SELECT * FROM {table_name};")
    rows = cursor.fetchall()
    for row in rows:
        print(row)

# Close the connection
conn.close()
