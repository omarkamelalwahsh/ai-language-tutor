import asyncio
import json
import os
from dotenv import load_dotenv

# Load .env
load_dotenv("backend/.env")

from app.integrations.groq_client import evaluate_dynamic_task

async def test_evaluator_engine():
    print("\n[TEST] Initializing Evaluator Engine Model 2...")
    
    # Task from Step 1
    task_prompt = "Respond to a business email about a missed meeting"
    task_rubric = {
        "focus": "Using the Present Perfect correctly to describe the situation",
        "target_structure": "Present Perfect vs Past Simple",
        "success_criteria": [
            "Correctly use the Present Perfect to describe the missed meeting",
            "Use appropriate business email vocabulary",
            "Clearly apologize and express interest in rescheduling"
        ]
    }
    
    # Mock Learner Response (with intentional errors)
    user_response = "Dear Sir, I am write to you because I missed the meeting last week. I have being very sick. I hope we can meet again soon."
    
    try:
        # Call the Evaluator
        evaluation, model_used = await evaluate_dynamic_task(
            prompt=task_prompt,
            rubric=task_rubric,
            user_response=user_response
        )
        
        print(f"\n[SUCCESS] Model Used: {model_used}")
        
        # Save to file to avoid console encoding issues
        with open("backend/scratch/evaluation_result.json", "w", encoding="utf-8") as f:
            json.dump(evaluation, f, indent=2, ensure_ascii=False)
        
        print("\n[DONE] Results saved to backend/scratch/evaluation_result.json")
        
    except Exception as e:
        print(f"\n[ERROR] Evaluator Engine Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_evaluator_engine())
