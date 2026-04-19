import asyncio
import uuid

def simulate_logic(current_level, buffer, predicted_level):
    valid_levels = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
    curr_val = valid_levels.get(current_level, 0)
    new_val = valid_levels.get(predicted_level, 0)
    
    is_initial = len(buffer) == 0
    new_buffer = (buffer + [predicted_level])[-3:]
    
    if is_initial:
        return predicted_level, new_buffer, "Initial Baseline"
    
    if new_val > curr_val:
        last_2 = new_buffer[-2:]
        if len(last_2) >= 2 and all(valid_levels.get(b) > curr_val for b in last_2):
            upgrade_target = min(last_2, key=lambda x: valid_levels.get(x))
            return upgrade_target, new_buffer, "UPGRADE"
    
    if new_val < curr_val:
        last_3 = new_buffer[-3:]
        if len(last_3) >= 3 and all(valid_levels.get(b) < curr_val for b in last_3):
            downgrade_target = max(last_3, key=lambda x: valid_levels.get(x))
            return downgrade_target, new_buffer, "DOWNGRADE"
    
    return current_level, new_buffer, "Stability Maintained (Buffered)"

async def test_proficiency_stability():
    print("\n--- Testing Proficiency Stability Logic ---")
    
    # Test Cases
    cases = [
        ("A1", [], "B2"),  # Case 1: Initial Baseline -> B2
        ("B2", ["B2"], "C1"), # Case 2: Spike C1 (Buffered) -> B2
        ("B2", ["B2", "C1"], "C1"), # Case 3: Second Strike C1 (Upgrade) -> C1
        ("C1", ["B2", "C1", "C1"], "A2"), # Case 4: Drop A2 (Buffered) -> C1
        ("C1", ["C1", "C1", "A2"], "A1"), # Case 5: More drop -> C1
        ("C1", ["C1", "A2", "A1"], "A2"), # Case 6: Third Strike below C1 (Downgrade) -> max(A2, A1, A2) = A2
    ]
    
    curr = "A1" # Starting baseline
    buf = []
    for start_level, start_buf, pred in cases:
        curr, buf, action = simulate_logic(curr, buf, pred)
        print(f"Pred: {pred} | New Level: {curr} | Action: {action} | Buffer: {buf}")

if __name__ == "__main__":
    asyncio.run(test_proficiency_stability())
