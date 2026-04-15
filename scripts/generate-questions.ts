import pool from '../server/db.js';
import OpenAI from 'openai';

// Get the Groq API Key from the environment
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ ERROR: GROQ_API_KEY is not set in your .env file!");
  process.exit(1);
}

const llmClient = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Configure Generation Matrices
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS = ['Reading', 'Listening', 'Grammar', 'Vocabulary'];

const TASK_FORMAT = 'passage_bundle';
const QUESTIONS_PER_TASK = 5; // Can be adjusted
const DIFFICULTY_TARGET = 0.6; // Base difficulty

const generatePrompt = (targetLevel: string, targetSkill: string) => {
  // Dynamically set stimulus length based on level
  let stimulusLength = 'medium';
  if (['C1', 'C2'].includes(targetLevel)) stimulusLength = 'long';
  if (['A1', 'A2'].includes(targetLevel)) stimulusLength = 'short';

  return `
### ROLE
You are a Lead Content Strategist for high-stakes English Proficiency Exams (IELTS Academic, TOEFL iBT, and Cambridge C1/C2). You specialize in evidence-based assessment design using the CEFR framework.

### CONTEXT & OBJECTIVE
The goal is to generate a high-complexity assessment block for ${targetLevel} proficiency. 
This task must move beyond surface-level comprehension to test "Critical Language Processing" and "Implicit Meaning."

### INPUT VARIABLES
- TARGET_LEVEL: ${targetLevel}
- TARGET_SKILL: ${targetSkill}
- TASK_FORMAT: ${TASK_FORMAT}
- TASK_COMPLEXITY: exam_like (Maximum Rigor)
- QUESTIONS_PER_TASK: ${QUESTIONS_PER_TASK}
- STIMULUS_LENGTH: ${stimulusLength}
- DIFFICULTY_TARGET: ${DIFFICULTY_TARGET}

### ADVANCED CEFR CALIBRATION (ADMIN REQUIREMENTS)
- B2: Focus on technical argumentation, identifying specific attitudes, and logical connectors.
- C1: Focus on long, cognitively demanding texts. Questions must target subtle nuances, irony, and "reading between the lines."
- C2: Master-level discourse. Use dense academic or literary structures. Distractors must be extremely plausible "word-traps" where keywords appear in the text but the logic is flawed.
- A1/A2/B1: Adjust the density while maintaining high-quality pedagogical standards suitable for the level.

### CORE INSTRUCTIONS
1. Create a sophisticated, internationally accessible stimulus relevant to the ${targetSkill} skill.
2. Ensure the stimulus length is "${stimulusLength}".
3. Questions must test:
   - Inference (What is implied but not stated?)
   - Discourse Cohesion (How do paragraphs relate?)
   - Lexical Shade (Why did the author choose "X" instead of "Y"?)
   - Purpose/Tone (What is the underlying motivation of the speaker/writer?)
4. Distractors must reflect realistic "misleads" found in high-level exams—do not make them obviously wrong.

### OUTPUT REQUIREMENTS
- Return STRICT JSON only. 
- No markdown code blocks.
- No introductory or concluding text.

### JSON SCHEMA
{
  "task_overview": {
    "task_type": "string",
    "instructions": "string",
    "cefr_level": "string",
    "skill": "string",
    "complexity": "string",
    "estimated_total_time_seconds": 600
  },
  "shared_stimulus": {
    "title": "string",
    "stimulus_type": "string",
    "text": "string"
  },
  "questions": [
    {
      "question_id": "Q1",
      "question_text": "string",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "string",
      "explanation": "Detailed pedagogical breakdown of why the answer is correct and why the distractors are specifically misleading for this CEFR level.",
      "metadata": {
        "cefr_level": "string",
        "skill": "string",
        "sub_skill": "string",
        "difficulty": 0.0,
        "estimated_time_seconds": 90
      }
    }
  ]
}

### FINAL GENERATION RULE
Generate one complete, high-difficulty task block. The "explanation" field must be rigorous to assist in AI-driven error analysis.
`;
};

// Helper to pause execution (to avoid Groq rate limits)
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function generateQuestionBank() {
  console.log(`🤖 Starting comprehensive Question Bank generation using Groq (llama-3.3-70b-versatile)...`);
  
  let totalStored = 0;

  for (const level of LEVELS) {
    for (const skill of SKILLS) {
      console.log(`\n⏳ Generating block for [${level} - ${skill}]...`);
      
      const promptText = generatePrompt(level, skill);

      try {
        const response = await llmClient.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are an expert language assessment JSON generator. Output valid JSON strictly." },
            { role: "user", content: promptText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const rawText = response.choices[0]?.message?.content;
        
        if (!rawText) throw new Error("Received empty response from Groq");

        const parsedData = JSON.parse(rawText);

        if (!parsedData || !Array.isArray(parsedData.questions)) {
          throw new Error("Expected a JSON object with a 'questions' array, but got something else.");
        }

        console.log(`✅ Received ${parsedData.questions.length} questions for [${level} - ${skill}]. Inserting...`);

        const taskOverview = parsedData.task_overview;
        let successCount = 0;

        const dbPayload = parsedData.questions.map((q: any, index: number) => ({
          external_id: `BUNDLE_${level}_${Date.now()}_Q${index}`,
          skill: skill.toLowerCase(),
          level,
          task_type: TASK_FORMAT,
          difficulty: q.metadata?.difficulty || DIFFICULTY_TARGET,
          prompt: q.question_text,
          stimulus: parsedData.shared_stimulus?.text || null,
          answer_key: {
            options: q.options,
            correct: q.correct_answer,
            explanation: q.explanation,
            sub_skill: q.metadata?.sub_skill || null,
            instructions: taskOverview?.instructions || null
          }
        }));

        for (const item of dbPayload) {
          try {
            await pool.query(
              `INSERT INTO question_bank_items 
              (external_id, skill, task_type, level, difficulty, prompt, stimulus, answer_key) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                item.external_id,
                item.skill,
                item.task_type,
                item.level,
                item.difficulty,
                item.prompt,
                item.stimulus,
                item.answer_key
              ]
            );
            successCount++;
          } catch (insertErr: any) {
            console.error(`❌ Failed to insert generated question: ${insertErr.message}`);
          }
        }
        
        totalStored += successCount;
        console.log(`✅ DB Insert done for [${level} - ${skill}]. Moving to next...`);

        // Wait a few seconds to respect rate limits before next generation
        await delay(5000);

      } catch (err: any) {
        console.error(`❌ Generator failed for [${level} - ${skill}]:`, err.message);
        // We wait a bit even on error to cool down
        await delay(5000);
      }
    }
  }

  console.log(`\n🎉 Full Generation Matrix complete! Successfully stored ${totalStored} new questions across all levels and skills.`);
  await pool.end();
}

// Start the overarching generator
generateQuestionBank();
