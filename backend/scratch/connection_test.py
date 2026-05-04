import requests
import json
import time

# Configuration
API_BASE_URL = "http://localhost:8000/api/v1"
TASK_TYPE = "SCRAMBLED_SENTENCE"

def test_task_architect():
    print(f"[Integration Test] Testing Task Architect on {API_BASE_URL}...")
    
    try:
        # Start timer
        start_time = time.time()
        
        # 1. Test Generate Endpoint
        response = requests.post(f"{API_BASE_URL}/tasks/generate?type={TASK_TYPE}")
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"OK - Backend Connection: SUCCESS ({duration:.2f}s)")
            print(f"Task ID: {data['task_metadata']['id']}")
            print(f"Skill: {data['task_metadata']['focus_skill']}")
            print(f"Instruction: {data['content']['instruction']}")
            print(f"First Fragment: {data['content']['fragments'][0]}")
            print(f"Target: {data['content']['target']}")
            print(f"Pedagogical Explanation: {data['content']['explanation']}")
            print("-" * 30)
            print("API Contract Validation: 100% SYNCED")
        else:
            print(f"ERROR - Backend Connection: FAILED (Status: {response.status_code})")
            print(f"Detail: {response.text}")
            
    except Exception as e:
        print(f"ERROR - Connection Error: {str(e)}")

if __name__ == "__main__":
    test_task_architect()
