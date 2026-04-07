import { describe, it, expect, vi } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';

// Mock signals/evaluateToGroq if needed, but we can just use the real engine
// and rely on the fact that if we have a mock bank in memory, it will work.

describe('AdaptiveAssessmentEngine Stabilization Stress Test', () => {
    it('Should stabilize level during [0.3, 0.4, 0.95, 0.95] sequence (Slow & Steady)', async () => {
        // Force the engine to have questions available
        const engine = new AdaptiveAssessmentEngine('B1');
        
        // We need to mock the evaluator because it calls an API
        // For this test, we'll manually inject "taskEvaluations" to simulate signals
        // OR we can mock the fetch call in submitAnswer.
        
        // Mocking fetch for /api/evaluate
        global.fetch = vi.fn().mockImplementation((url, init) => {
            if (url === '/api/evaluate' || url === '/api/questions') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([]) // Empty bank is fine if we have fallback logic
                });
            }
            return Promise.reject(new Error("Not found"));
        });

        // We will directly manipulate the state to simulate the scenario
        // because we want to test the LOGIC of CalibrationReset and Selector.
        
        // 1. Manually populate task evaluations to represent [0.3, 0.4, 0.95, 0.95]
        // This simulates the user finishing 4 questions.
        const evaluations = [0.3, 0.4, 0.95, 0.95].map((val, i) => ({
            taskId: `q${i}`,
            primarySkill: 'writing',
            validAttempt: true,
            channels: {
                lexicalRange: val,
                grammarAccuracy: val,
                taskCompletion: val
            },
            difficulty: 'B1',
            skill: 'writing'
        }));

        // @ts-ignore - Accessing private state for stress testing
        engine.state.taskEvaluations = evaluations;
        // @ts-ignore
        engine.state.questionsAnswered = 4;

        // 2. Run Calibration Reset
        // @ts-ignore
        engine.performCalibrationReset();

        // 🎯 EXPECTATION: Trimmed mean of [0.3, 0.4, 0.95, 0.95] is (0.4 + 0.95) / 2 = 0.675
        // This should NOT trigger a jump to A2 (<0.45) or C1 (>0.85).
        // It stays at B1.
        
        // @ts-ignore
        const currentOverall = engine.efsetOverall.levelRange[0];
        expect(currentOverall).toBe('B1'); // Improved: It stayed B1 instead of jumping.

        // 3. Test Selector Momentum for Question 5
        // Q5 should be fetched now.
        const q5 = await engine.getNextQuestion();
        
        // @ts-ignore
        const probeLevel = q5?.difficulty || engine.efsetOverall.levelRange[0];
        
        // 🎯 EXPECTATION: Momentum calculation:
        // (0.95 * 0.5) + (0.95 * 0.3) + (0.4 * 0.2) = 0.475 + 0.285 + 0.08 = 0.84
        // 0.84 is > 0.82 (Momentum Step Up).
        // So B1 + 1 = B2.
        // It should be B2, NOT C1 (Leapfrog).
        
        expect(probeLevel).toBe('B2'); 
        console.log(`[Test] Question 5 targeted level: ${probeLevel}`);
    });
});
