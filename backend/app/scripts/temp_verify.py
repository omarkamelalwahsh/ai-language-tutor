import asyncio
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as s:
        r2 = await s.execute(text("""
            SELECT jm.id as map_id, COUNT(n.id) as total_nodes,
                   SUM(CASE WHEN n.type='catch_up' THEN 1 ELSE 0 END) as catchup_nodes,
                   SUM(CASE WHEN n.type='core' THEN 1 ELSE 0 END) as core_nodes
            FROM journey_maps jm
            JOIN nodes n ON n.journey_map_id = jm.id
            WHERE jm.user_id = '9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe'
              AND jm.is_completed = false
            GROUP BY jm.id
        """))
        row2 = r2.first()
        print("=== Journey Map for alwahsh401 ===")
        if row2:
            print(f"  Map ID: {row2.map_id}")
            print(f"  Total Nodes: {row2.total_nodes}")
            print(f"  Catch-Up Nodes: {row2.catchup_nodes}")
            print(f"  Core Nodes: {row2.core_nodes}")

        r3 = await s.execute(text("""
            SELECT n.node_index, n.type, n.title, n.is_locked
            FROM journey_maps jm
            JOIN nodes n ON n.journey_map_id = jm.id
            WHERE jm.user_id = '9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe'
              AND jm.is_completed = false
            ORDER BY n.node_index
        """))
        rows3 = r3.all()
        print("\n=== Node List ===")
        for row in rows3:
            lock = "LOCKED" if row.is_locked else "OPEN"
            title_safe = row.title.encode('ascii', 'replace').decode('ascii')
            print(f"  [{lock:>6}] idx={row.node_index:>3} | {row.type:>8} | {title_safe}")

if __name__ == '__main__':
    asyncio.run(run())
