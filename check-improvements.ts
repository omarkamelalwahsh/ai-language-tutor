import { AdaptiveAssessmentEngine } from './src/services/AdaptiveAssessmentEngine';
import { LearnerContextProfile, AssessmentQuestion } from './src/types/assessment';
import { QUESTION_BANK } from './src/data/assessment-questions';

async function run() {
  console.log('--- Improvements Verification ---');
  
  const profile: LearnerContextProfile = {
    goal: 'professional',
    goalContext: 'software',
    preferredTopics: ['technology']
  };

  // 1. Cold Start Check
  console.log('\n[1] Checking Cold Start (Broad Spectrum Priority)...');
  const engine = new AdaptiveAssessmentEngine('B1', profile);
  const q1 = await engine.getNextQuestion();
  console.log('First question selected:', q1?.id, q1?.type, '(Expected: A multi-skill task)');
  
  // 2. Feedback Loop Check (Struggle Dampening)
  console.log('\n[2] Checking Feedback Loop (Struggle Dampening)...');
  
  // We need to simulate 2 fails in 'software' domain
  const softwareTask = QUESTION_BANK.find(q => q.domainTags?.includes('software')) as AssessmentQuestion;
  
  console.log('Simulating 2 fails in Software domain...');
  // Score 0.1 = Fail
  await engine.submitAnswer(softwareTask, 'fail', 1000);
  await engine.submitAnswer(softwareTask, 'fail', 1000);
  
  console.log('Checking next question selection with dampening...');
  // The log should show " (Dampened)" and the boost should be halved
  const next = await engine.getNextQuestion();
  console.log('Next question selected after struggle:', next?.id);
}

run().catch(console.error);
