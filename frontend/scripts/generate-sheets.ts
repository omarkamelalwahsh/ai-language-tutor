import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../data/question_banks');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("❌ ERROR: GROQ_API_KEY is not set in your .env file!");
  process.exit(1);
}

const llmClient = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// We will generate the following distribution per level:
// - 1 Shared Stimulus Set (1 Stimulus + 5 Reading MCQ + 5 Writing Open-Ended) -> 10 questions
// - 10 Listening MCQ
// - 10 Grammar MCQ
// - 10 Vocabulary MCQ
// - 5 Speaking Audio
// Total = 45 questions per level. For 6 levels = 270 questions.
// This is a robust initial pool that can be expanded later by simply running the script again.

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function callLLM(promptText: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await llmClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are an expert language assessment JSON generator. Output valid JSON strictly without markdown wrappers. Return only the JSON." },
          { role: "user", content: promptText }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const rawText = response.choices[0]?.message?.content;
      if (!rawText) throw new Error("Received empty response from Groq");
      return JSON.parse(rawText);
    } catch (err: any) {
      console.warn(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await delay(5000 * attempt); // Backoff
    }
  }
}

// ------------------------------------------------------------------
// PROMPT TEMPLATES
// ------------------------------------------------------------------

function getStimulusSharedPrompt(level: string) {
  return `
Create a ${level} CEFR-level Reading & Writing assessment task.
You must generate ONE shared stimulus (passage) that is appropriate for ${level} level. Length should be proportional to the level (A1=Short, C2=Long and complex).

Generate exactly 10 questions targeting the same stimulus:
- 5 Reading Comprehension questions (Multiple Choice). Options should be plausible.
- 5 Writing Prompt questions (Open Ended). These should ask the student to respond to or reflect on the passage by writing a paragraph or essay.

Output ONLY valid JSON matching this schema:
{
  "stimulus": "The text of the passage here...",
  "questions": [
    {
      "skill": "reading",
      "task_type": "mcq",
      "difficulty": 0.5,
      "prompt": "Question text here...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Why this is correct."
    },
    {
      "skill": "writing",
      "task_type": "open_ended",
      "difficulty": 0.5,
      "prompt": "Writing prompt based on the passage...",
      "options": [],
      "correct_answer": "",
      "explanation": "Key points expected in a strong answer."
    }
  ]
}
Ensure exactly 5 'reading' and 5 'writing' questions.
`;
}

function getMCQPrompt(level: string, skill: 'listening' | 'grammar' | 'vocabulary', count: number) {
  let extraContext = '';
  if (skill === 'listening') {
    extraContext = "For listening, the 'stimulus' field should act as the transcript of what is being heard. The prompt asks about this transcript.";
  } else {
    extraContext = "For grammar and vocabulary, no stimulus is needed (it can be empty or null).";
  }

  return `
Create exactly ${count} ${level} CEFR-level ${skill} Multiple Choice Questions.
${extraContext}

Output ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "skill": "${skill}",
      "task_type": "mcq",
      "difficulty": 0.5,
      "stimulus": "Optional context or transcript.",
      "prompt": "The actual question or fill-in-the-blank...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "Why a is right and the others are wrong."
    }
  ]
}
`;
}

function getSpeakingPrompt(level: string, count: number) {
  return `
Create exactly ${count} ${level} CEFR-level speaking prompts.
These questions should prompt the learner to record their voice.
A1 could be simple read-aloud or basic facts. C2 could be defending a complex viewpoint.

Output ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "skill": "speaking",
      "task_type": "audio",
      "difficulty": 0.5,
      "prompt": "Describe a time when you...",
      "options": [],
      "correct_answer": "",
      "explanation": "What constitutes a good spoken response at this level."
    }
  ]
}
`;
}

// ------------------------------------------------------------------
// GENERATOR ENGINE
// ------------------------------------------------------------------

function buildDatabasePayload(level: string, rawData: any, stimulus?: string) {
  const finalItems: any[] = [];
  const baseId = `GEN_${level}_${Date.now()}`;
  
  if (rawData.questions && Array.isArray(rawData.questions)) {
    rawData.questions.forEach((q: any, i: number) => {
      finalItems.push({
        external_id: `${baseId}_${q.skill}_${i}`,
        skill: q.skill || 'reading',
        task_type: q.task_type || 'mcq',
        target_cefr: level,
        difficulty: q.difficulty || 0.5,
        prompt: q.prompt,
        stimulus: q.stimulus || stimulus || null,
        answer_key: {
          options: q.options || [],
          correct_index: q.options ? q.options.indexOf(q.correct_answer) : -1,
          correct: q.correct_answer || "",
          explanation: q.explanation || ""
        }
      });
    });
  }
  return finalItems;
}

async function generateSheetForLevel(level: string, batchNumber: number) {
  console.log(`\n===========================================`);
  console.log(`🚀 Starting Generation for Level: ${level} [BATCH ${batchNumber}]`);
  console.log(`===========================================`);
  
  const sheetItems: any[] = [];

  // 1. Shared Stimulus (Reading & Writing)
  console.log(`[${level}] Generating Shared Stimulus (Reading + Writing)...`);
  try {
    const sharedData = await callLLM(getStimulusSharedPrompt(level));
    const sharedStimulus = sharedData.stimulus || "";
    const items = buildDatabasePayload(level, sharedData, sharedStimulus);
    sheetItems.push(...items);
    console.log(`  -> Added ${items.length} items.`);
  } catch (e) {
    console.error(`  -> Failed Shared Stimulus:`, e);
  }
  await delay(2000);

  // 2. Listening MCQs
  console.log(`[${level}] Generating 10 Listening MCQs...`);
  try {
    const data = await callLLM(getMCQPrompt(level, 'listening', 10));
    const items = buildDatabasePayload(level, data);
    sheetItems.push(...items);
    console.log(`  -> Added ${items.length} items.`);
  } catch (e) {
    console.error(`  -> Failed Listening:`, e);
  }
  await delay(2000);

  // 3. Grammar MCQs
  console.log(`[${level}] Generating 10 Grammar MCQs...`);
  try {
    const data = await callLLM(getMCQPrompt(level, 'grammar', 10));
    const items = buildDatabasePayload(level, data);
    sheetItems.push(...items);
    console.log(`  -> Added ${items.length} items.`);
  } catch (e) {
    console.error(`  -> Failed Grammar:`, e);
  }
  await delay(2000);

  // 4. Vocabulary MCQs
  console.log(`[${level}] Generating 10 Vocabulary MCQs...`);
  try {
    const data = await callLLM(getMCQPrompt(level, 'vocabulary', 10));
    const items = buildDatabasePayload(level, data);
    sheetItems.push(...items);
    console.log(`  -> Added ${items.length} items.`);
  } catch (e) {
    console.error(`  -> Failed Vocabulary:`, e);
  }
  await delay(2000);

  // 5. Speaking Tasks
  console.log(`[${level}] Generating 5 Speaking Tasks...`);
  try {
    const data = await callLLM(getSpeakingPrompt(level, 5));
    const items = buildDatabasePayload(level, data);
    sheetItems.push(...items);
    console.log(`  -> Added ${items.length} items.`);
  } catch (e) {
    console.error(`  -> Failed Speaking:`, e);
  }

  // Save the sheet
  const filename = path.join(OUTPUT_DIR, `${level}_sheet_${batchNumber}.json`);
  fs.writeFileSync(filename, JSON.stringify(sheetItems, null, 2));
  console.log(`✅ Saved ${sheetItems.length} questions to ${filename}`);
  return sheetItems.length;
}

async function main() {
  let total = 0;
  for (let batch = 2; batch <= 5; batch++) {
    console.log(`\n\n🌟🌟🌟 STARTING MASSIVE BATCH ${batch} OF 5 🌟🌟🌟`);
    for (const level of LEVELS) {
      const count = await generateSheetForLevel(level, batch);
      total += count;
      console.log(`Waiting 5s before next level to prevent rate limits...`);
      await delay(5000);
    }
    console.log(`Waiting 15s between batches to cool down Groq API limits...`);
    await delay(15000);
  }
  console.log(`\n🎉 Full Mass-Generation Complete! Total new questions wrapped: ${total}`);
}

main().catch(console.error);
