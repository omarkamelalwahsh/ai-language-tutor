import asyncio
import os
import sys
import json

# Ensure UTF-8 for Windows Terminal (Arabic support)
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Add backend to path to import app modules
sys.path.append(os.getcwd())

from app.integrations.groq_client import generate_architect_task

async def test_engine_directly():
    print("[Logic Audit] Triggering Pure AI Task Generation...")
    
    # Mock User Profile for an ML Engineer - TESTING AUDIO_CHOICE
    user_context = {
        "user_level": "B2",
        "user_domain": "Junior Machine Learning Engineer",
        "last_errors": ["phonetic confusion", "technical jargon"],
        "task_type": "AUDIO_CHOICE",
        "focus_skill": "Auditory Precision",
        "difficulty": 0.75
    }
    
    try:
        print(f"Requesting task for: {user_context['user_domain']} (Level: {user_context['user_level']})")
        
        result, model = await generate_architect_task(
            user_level=user_context["user_level"],
            weakness_areas=[],
            last_errors=user_context["last_errors"],
            user_domain=user_context["user_domain"],
            task_type=user_context["task_type"],
            focus_skill=user_context["focus_skill"],
            difficulty=user_context["difficulty"]
        )
        
        print(f"\nOK - GENERATION SUCCESS (Model: {model})")
        print("-" * 50)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print("-" * 50)
        
    except Exception as e:
        print(f"Logic Error: {str(e)}")

if __name__ == "__main__":
    # Ensure we are in the right directory or handle paths
    asyncio.run(test_engine_directly())
