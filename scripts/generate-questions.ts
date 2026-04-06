import pool from '../server/db.js';

// Get the Gemini API Key from the environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is not set in your .env file!");
  process.exit(1);
}

// Ensure you define the exact target parameters
const TARGET_CEFR = 'B2';
const TARGET_SKILL = 'grammar';
const NUM_QUESTIONS = 10;

const prompt = `
You are an expert linguistics assessor and EF SET certified English test creator. 
Generate exactly ${NUM_QUESTIONS} English ${TARGET_SKILL} assessment questions for a ${TARGET_CEFR} proficiency level.

Output strictly as a valid JSON array of objects. Do NOT wrap in markdown blocks like \`\`\`json. Every object MUST follow this schema exactly:
{
  "skill": "${TARGET_SKILL}",
  "task_type": "mcq",
  "target_cefr": "${TARGET_CEFR}",
  "difficulty": 0.65,
  "prompt": "The actual question. For example: Fill in the blank: By next year, she ___ her degree.",
  "stimulus": null,
  "answer_key": {
    "options": ["will have finished", "will finish", "had finished", "finishes"],
    "correctAnswer": "will have finished"
  }
}
`;

async function generateQuestions() {
  console.log(`🤖 Requesting ${NUM_QUESTIONS} ${TARGET_CEFR} ${TARGET_SKILL} questions from Gemini...`);
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) throw new Error("Received empty response from Gemini");

    const questions = JSON.parse(rawText);

    if (!Array.isArray(questions)) {
      throw new Error("Expected a JSON array of questions, but got something else.");
    }

    console.log(`✅ Received ${questions.length} questions from Gemini. Inserting into database...`);

    let successCount = 0;
    for (const q of questions) {
      try {
        const externalId = `AI_GEN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        await pool.query(
          `INSERT INTO question_bank_items 
          (external_id, skill, task_type, target_cefr, difficulty, prompt, stimulus, answer_key) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            externalId,
            q.skill || TARGET_SKILL,
            q.task_type || 'mcq',
            q.target_cefr || TARGET_CEFR,
            q.difficulty || 0.5,
            q.prompt,
            q.stimulus || null,
            q.answer_key
          ]
        );
        successCount++;
      } catch (insertErr: any) {
        console.error(`❌ Failed to insert generated question: ${insertErr.message}`);
      }
    }

    console.log(`\n🎉 Magic complete! Successfully stored ${successCount} new questions in the database.`);

  } catch (err: any) {
    console.error("❌ Generator failed:", err.message);
  } finally {
    await pool.end();
  }
}

// Start the generator
generateQuestions();
