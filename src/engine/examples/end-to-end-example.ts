import { createInitialLearnerModel } from '../frameworks/skill-registry';
import { ChallengeBlueprint, ChallengeResult } from '../domain/types';
import { runUpdatePipeline } from '../pipeline/update-pipeline';

// 1. Initialize a new learner (Starting low A2)
const learnerModel = createInitialLearnerModel('learner-123', {
  type: 'general',
  targetLevel: 'B2',
  focusSkills: ['writing', 'listening']
}, 25);

console.log("=== Initial State ===");
console.log(`Overall Level: ${learnerModel.overallBand.primary} (Score: ${learnerModel.overallScore})`);
console.log(`Writing Score: ${learnerModel.skills.writing.score}`);
console.log(`Listening Score: ${learnerModel.skills.listening.score}`);
console.log(`Spelling Subskill: ${learnerModel.subskills['writing.spelling'].score}`);


// 2. Define a Challenge Blueprint for "Listen and Write"
const listenAndWriteBlueprint: ChallengeBlueprint = {
  blueprintId: 'task_lw_101',
  name: 'Daily Routine Dictation',
  description: 'Listen to a short sentence and transcribe it.',
  primarySkill: 'writing', // It's transcription, heavily writing-focused mechanics
  secondarySkills: ['listening'],
  challengeType: 'dictation',
  targetedSubskills: [
    { subskillId: 'listening.detail_extraction', weight: 0.4 },
    { subskillId: 'writing.spelling', weight: 0.3 },
    { subskillId: 'shared.grammar_control', weight: 0.3 }
  ],
  difficultyRange: { min: 'A1', max: 'B1' },
  expectedDurationSec: 30,
  stimulus: {
    audioText: "She goes to school every day."
  },
  scoringDimensions: [
    { dimensionId: 'accuracy', label: 'Accuracy', weight: 0.5 },
    { dimensionId: 'spelling', label: 'Spelling', weight: 0.3 },
    { dimensionId: 'completeness', label: 'Completeness', weight: 0.2 }
  ]
};

// 3. Create the learner's result
const learnerResult: ChallengeResult = {
  blueprintId: listenAndWriteBlueprint.blueprintId,
  blueprint: listenAndWriteBlueprint,
  attemptId: 'att_001',
  learnerResponse: "She go to scool every day.",
  responseTimeMs: 15000,
  hintsUsed: 0,
  retryCount: 0,
  completedAt: new Date().toISOString(),
  responseData: {}
};

// 4. Run the Pipeline
console.log("\n=== Processing Pipeline ===");
const pipelineResult = runUpdatePipeline(learnerResult, learnerModel);

// 5. Output the traces for explainability
console.log("\n--- Step 1: Sub-scores ---");
console.log(`Overall Task Score: ${pipelineResult.scoredResult.overallScore}`);
console.log(`Dimension Scores:`, pipelineResult.scoredResult.dimensionScores);

console.log("\n--- Step 2: Extracted Observations ---");
pipelineResult.observations.forEach((obs: any) => {
  console.log(`[${obs.polarity.toUpperCase()}] -> ${obs.targetSubskillId} (Strength: ${obs.strength})`);
  console.log(`  Reason: ${obs.description}`);
  if (obs.attributionReasoning) {
      console.log(`  Attribution Logic: ${obs.attributionReasoning}`);
  }
});

console.log("\n--- Step 3: Evidence Units Applied ---");
pipelineResult.evidenceUnits.forEach((unit: any) => {
  console.log(`Target: ${unit.targetSubskillId}`);
  console.log(`  Unit Raw Delta: ${unit.rawDelta}`);
  console.log(`  Unit Modulated Delta: ${unit.modulatedDelta}`);
  console.log(`  Reasoning: ${unit.reasoning}`);
});

console.log("\n--- Step 4: Subskill Updates ---");
Object.entries(pipelineResult.subskillUpdates).forEach(([subskillId, changes]: [string, any]) => {
   console.log(`${subskillId}: ${changes.previousScore} -> ${changes.newScore} (Delta: ${changes.delta})`);
});

console.log("\n--- Step 5: Skill Updates ---");
pipelineResult.skillUpdates.forEach((update: any) => {
  console.log(`${update.skillId}: ${update.previousScore} -> ${update.newScore}`);
  console.log(`  Band: ${update.previousBand.primary} -> ${update.newBand.primary}`);
});

console.log("\n--- Step 6: Final Updated Learner Model ---");
const finalModel = pipelineResult.updatedModel;
console.log(`New Overall Level: ${finalModel.overallBand.primary} (Score: ${finalModel.overallScore})`);
console.log(`Total Evidence Absorbed: ${finalModel.totalEvidenceAbsorbed}`);

console.log("\n--- Step 7: Next Pedagogical Decision ---");
console.log(`Action: ${pipelineResult.nextPlan.action}`);
console.log(`Focus Area: ${pipelineResult.nextPlan.focusAreas.join(", ")}`);
console.log(`Reasoning: ${pipelineResult.nextPlan.reasoning}`);
