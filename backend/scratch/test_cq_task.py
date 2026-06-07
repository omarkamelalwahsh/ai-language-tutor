import asyncio
import json
import os
import sys

# Setup paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.task_generator import TaskGenerator

# Mock Profile Aggregator to avoid DB logic
class MockAggregator:
    async def get_unified_profile(self, user_id, db):
        return {
            "user_domain": "Software Engineering",
            "user_level": "B2",
            "interests": "Artificial Intelligence, Python",
            "target_goal": "Professional Fluency in Tech",
            "last_errors": [],
            "legacy_data": []
        }

from app.services import task_generator
task_generator.aggregator = MockAggregator()

# Mock VocabLogService to avoid DB logic
class MockVocabLogService:
    @staticmethod
    async def get_recent_user_vocabulary(db, user_id):
        return ["API", "variable"]
        
    @staticmethod
    async def log_vocabulary_exposure(db, user_id, word, metadata):
        pass

task_generator.VocabLogService = MockVocabLogService()

async def run_tests():
    print("Testing CQ Task Generation: 'Idiom Challenge'")
    result = await TaskGenerator.generate_task("test_user", "Idiom Challenge", None)
    print(json.dumps(result, indent=2))
    print("\n-----------------------\n")
    print("Testing Listening Task Generation: 'Main Idea Extraction'")
    result2 = await TaskGenerator.generate_task("test_user", "Main Idea Extraction", None)
    print(json.dumps(result2, indent=2))

if __name__ == "__main__":
    asyncio.run(run_tests())
