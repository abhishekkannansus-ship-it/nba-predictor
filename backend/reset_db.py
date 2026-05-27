import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "predictions.db")

conn = sqlite3.connect(DB_PATH)
conn.execute("DELETE FROM predictions")
conn.execute("DELETE FROM sqlite_sequence WHERE name='predictions'")
conn.commit()
conn.close()
print("Database reset complete — all predictions cleared.")
