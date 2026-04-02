import { AdaptiveAssessmentEngine } from './src/services/AdaptiveAssessmentEngine';

async function test() {
  const engine = new AdaptiveAssessmentEngine('A2');
  
  const question: any = {
    id: 'test-1',
    primarySkill: 'listening',
    difficulty: 'A2',
    type: 'listening_summary',
    prompt: 'Listen and summarize.',
    subskills: []
  };

  console.log('Testing listening_summary propagation...');
  // Simulating weights
  const weights = (engine as any).getDefaultWeights(question.type);
  console.log('Default weights for listening_summary:', weights);

  if (weights.writing === 0.7 && weights.grammar === 0.5 && weights.vocabulary === 0.5) {
    console.log('✅ Weights are correct!');
  } else {
    console.log('❌ Weights are INCORRECT!');
    process.exit(1);
  }

  const shortTextWeights = (engine as any).getDefaultWeights('short_text');
  console.log('Default weights for short_text:', shortTextWeights);
  if (shortTextWeights.writing === 1.0 && shortTextWeights.grammar === 0.5 && shortTextWeights.vocabulary === 0.5) {
    console.log('✅ Weights are correct!');
  } else {
     console.log('❌ Weights are INCORRECT!');
     process.exit(1);
  }
}

test();
