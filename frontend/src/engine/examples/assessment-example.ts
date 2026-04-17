import { evaluateResponse } from '../assessment';

console.log("=== Deterministic MVP Assessment Engine Verification ===\n");

// Test 1: Weak, short A1 response
console.log("--- Test 1: Self Introduction (Weak) ---");
const t1 = evaluateResponse(
    "hello my name is ali i am student.", 
    'self_introduction', 
    'speaking_proxy'
);
console.log(`Score:     ${t1.weightedScore}`);
console.log(`Band:      ${t1.estimatedBand} (${t1.bandLabel})`);
console.log(`Strengths: ${t1.strengths.join(', ')}`);
console.log(`Weakness:  ${t1.weaknesses.join(', ')}`);


// Test 2: B1/B2 Opinion Essay with connectors and logical flow
console.log("\n--- Test 2: Opinion Essay (Strong) ---");
const opinionText = `I believe that working from home has a massive advantage. 
Firstly, it saves time because you don't travel.
However, there are some problems. For example, people feel isolated.
Overall, therefore, it is a mixed situation but mostly beneficial.`;

const t2 = evaluateResponse(opinionText, 'opinion_essay', 'writing');
console.log(`Score:     ${t2.weightedScore}`);
console.log(`Band:      ${t2.estimatedBand} (${t2.bandLabel})`);
console.log(`Features:  Connectors: ${t2.rawFeatures.connectorCount}, AdvConnectors: ${t2.rawFeatures.advancedConnectorCount}`);
console.log(`Strengths: ${t2.strengths.join(', ')}`);
console.log(`Weakness:  ${t2.weaknesses.join(', ')}`);


// Test 3: Picture Description with spatial/observable keywords
console.log("\n--- Test 3: Picture Description ---");
const picText = `In the picture there is a big cat on the right. 
Behind the cat, I can see a tree. The cat looks like it is sleeping.`;

const t3 = evaluateResponse(picText, 'picture_description', 'visual_description', {
    targetKeywords: ['cat', 'tree', 'sleeping']
});
console.log(`Score:     ${t3.weightedScore}`);
console.log(`Band:      ${t3.estimatedBand} (${t3.bandLabel})`);
console.log(`Dims:      ${JSON.stringify(t3.dimensionScores)}`);
