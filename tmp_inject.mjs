import fs from 'fs';

let code = fs.readFileSync('src/data/assessment-questions.ts', 'utf8');

code = code.replace(/difficulty:\s*'([A-C][1-2][\+]?)',/g, (match, band, offset, string) => {
  const prevContext = string.slice(Math.max(0, offset - 120), offset);
  const skillMatch = prevContext.match(/primarySkill:\s*'([^']+)'/);
  
  if (!skillMatch) return match; // skip if not found
  const pSkill = skillMatch[1];
  
  let weights = `skillWeights: { ${pSkill}: 1.0, vocabulary: 0.3 }`;
  let channels = `scoringChannels: ['comprehension', 'grammar_accuracy']`;
  
  if (pSkill === 'writing' || pSkill === 'speaking') {
    weights = `skillWeights: { ${pSkill}: 1.0, grammar: 0.5, vocabulary: 0.5 }`;
    channels = `scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency']`;
  } else if (pSkill === 'listening') {
    weights = `skillWeights: { ${pSkill}: 1.0, grammar: 0.2 }`;
    channels = `scoringChannels: ['comprehension']`;
  }
  
  // check if we already injected
  if (prevContext.includes('skillWeights')) return match;

  return `${weights},\n    ${channels},\n    ${match}`;
});

fs.writeFileSync('src/data/assessment-questions.ts', code);
console.log('Task bank metadata injected successfully.');
