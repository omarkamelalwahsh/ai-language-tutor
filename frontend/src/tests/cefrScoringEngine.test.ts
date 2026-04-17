import { describe, it, expect } from 'vitest';
import { SignalExtractor } from '../engine/scoring/SignalExtractor';
import { EvidenceMapper } from '../engine/scoring/EvidenceMapper';
import { SkillAggregator } from '../engine/cefr/SkillAggregator';
import { CEFREngine } from '../engine/cefr/CEFREngine';
import { LLMSignal, QuestionBankItem, SkillState } from '../types/efset';

describe('EF SET Intelligence Scoring', () => {

  describe('SkillAggregator Weighted Scoring', () => {
    it('should weight B2 evidence higher than A1 evidence', () => {
      let state: SkillState = {
        score: 0.5, levelRange: ['B1', 'B1'], confidence: 0,
        directEvidenceCount: 0, consistency: 1, status: 'insufficient_data',
        history: []
      };

      // Scenario: A1 question answered perfectly (Score 1.0)
      const evA1 = { skill: 'writing', score: 1.0, weight: 1.0, direct: true, numericDifficulty: 1 };
      const stateA1 = SkillAggregator.update(state, evA1);
      
      // Scenario: B2 question answered perfectly (Score 1.0)
      const evB2 = { skill: 'writing', score: 1.0, weight: 1.0, direct: true, numericDifficulty: 4 };
      const stateB2 = SkillAggregator.update(state, evB2);
      
      // Both should have score 1.0 if only 1 item, but cumulative influence differs.
      // Let's test with 2 items.
      const evHigh = { skill: 'writing', score: 0.8, weight: 1.0, direct: true, numericDifficulty: 4 }; // B2
      const evLow = { skill: 'writing', score: 0.2, weight: 1.0, direct: true, numericDifficulty: 1 };  // A1
      
      let stateMixed = SkillAggregator.update(state, evHigh);
      stateMixed = SkillAggregator.update(stateMixed, evLow);
      
      // Weighted Sum: (0.8 * 4 * 1) + (0.2 * 1 * 1) = 3.2 + 0.2 = 3.4
      // Total Impact: (4*1) + (1*1) = 5
      // Expected Score: 3.4 / 5 = 0.68
      expect(stateMixed.score).toBeCloseTo(0.68);
    });

    it('should apply Overperformance Control (penalty for easy items)', () => {
       // Current user estimate is B2 (value 4)
       const stateB2: SkillState = {
         score: 0.75, levelRange: ['B2', 'B2'], confidence: 0.8,
         directEvidenceCount: 5, consistency: 0.9, status: 'stable',
         history: []
       };

       // Answering an A1 question (value 1) - Gap is 3.0 (> 1.5)
       const evA1 = { skill: 'writing', score: 1.0, weight: 1.0, direct: true, numericDifficulty: 1 };
       const updated = SkillAggregator.update(stateB2, evA1);
       
       const lastHistory = updated.history[updated.history.length - 1];
       expect(lastHistory.weight).toBe(0.5); // Penalty applied
    });
  });

  describe('Dynamic Ranges', () => {
    it('should return a range when confidence is low', () => {
       const [min, max] = SkillAggregator.scoreToRange(0.65, 0.5); // B1 score, low confidence
       expect(min).not.toBe(max);
       expect(max).toBe('B1');
    });

    it('should narrow to single level when confidence is high', () => {
       const [min, max] = SkillAggregator.scoreToRange(0.75, 0.9); // B2 score, high confidence
       expect(min).toBe('B2');
       expect(max).toBe('B2');
    });
  });
});
