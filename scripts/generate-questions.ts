import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_API_KEY) {
  console.error("❌ ERROR: Missing credentials in .env (Supabase or Groq)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const llmClient = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ============================================================================
// PEDAGOGICAL TOPIC ROADMAP (Strict Logic & No Randomness)
// ============================================================================
const TOPIC_MAP: Record<string, Record<string, string[]>> = {
  'A1': {
    'Grammar': ['Verb to be', 'Subject Pronouns', 'Present Simple (Basic)'],
    'Reading': ['Personal Profiles', 'Short Messages'],
    'Listening': ['Personal Introductions', 'Numbers & Prices'],
    'Vocabulary': ['Family Members', 'Common Foods'],
    'Writing': ['Introducing Yourself', 'Describing your Room'],
    'Speaking': ['Greeting People', 'Saying your Name']
  },
  'A2': {
    'Grammar': ['Past Simple', 'Present Continuous'],
    'Reading': ['Local News Snippets', 'Travel Ads'],
    'Listening': ['Everyday Conversations', 'Shopping Dialogue'],
    'Vocabulary': ['Jobs & Work', 'Health & Illness'],
    'Writing': ['Your Last Holiday', 'A Day in my Life'],
    'Speaking': ['Ordering Food', 'Giving Directions']
  },
  'B1': {
    'Grammar': ['Present Perfect', 'Modals (Possibility)'],
    'Reading': ['Product Reviews', 'Advice Columns'],
    'Listening': ['Detailed Narratives', 'Radio Interviews'],
    'Vocabulary': ['Environment', 'Social Media'],
    'Writing': ['A Review of a Movie', 'An Email to a Friend'],
    'Speaking': ['Expressing Opinions', 'Discussing Future Plans']
  },
  'B2': {
    'Grammar': ['Future Perfect', 'Mixed Conditionals'],
    'Reading': ['Op-Eds', 'Technical Summaries'],
    'Listening': ['Podcasts', 'University Lectures'],
    'Vocabulary': ['Education Systems', 'Media & Politics'],
    'Writing': ['Argumentative Essay', 'Formal Report'],
    'Speaking': ['Debating Social Issues', 'Giving a Presentation']
  }
};

const LEVELS = ['A1', 'A2', 'B1', 'B2']; 
const SKILLS = ['Grammar', 'Reading', 'Listening', 'Vocabulary', 'Writing', 'Speaking'];

const TASK_FORMAT = 'passage_bundle';
const QUESTIONS_PER_TASK = 4; // Ensure we get Easy, Medium, and Hard coverage

const generatePrompt = (targetLevel: string, targetSkill: string, topicName: string) => {
  let stimulusLength = 'medium';
  if (['C1', 'C2'].includes(targetLevel)) stimulusLength = 'long';
  if (['A1', 'A2'].includes(targetLevel)) stimulusLength = 'short';

  return `
### ROLE
You are a Lead Content Strategist for high-stakes English Proficiency Exams (IELTS Academic, TOEFL iBT). You specialize in pedagogical Scaffolding.

### OBJECTIVE
Generate a highly cohesive assessment block for level ${targetLevel} in the skill of ${targetSkill}.
TOPIC: "${topicName}"

### STRICT LOGIC & ORDERING RULES
1. SCAFFOLDING: Questions MUST follow a logical progression from easiest to hardest.
2. TOPIC COHERENCE: All questions must stay strictly within the context of "${topicName}".
3. STIMULUS ANCHORING: All questions must be derived from the SAME shared stimulus.
4. DISTRACTOR RIGOR: Distractors must be plausible "word-traps" specific to ${targetLevel}.

### INPUT VARIABLES
- TARGET_LEVEL: ${targetLevel}
- TARGET_SKILL: ${targetSkill}
- STIMULUS_LENGTH: ${stimulusLength}
- QUESTIONS_PER_TASK: ${QUESTIONS_PER_TASK}

### JSON SCHEMA
{
  "shared_stimulus": {
    "title": "string",
    "text": "string (Focus on ${topicName})"
  },
  "questions": [
    {
      "question_text": "string",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "string",
      "explanation": "State why it's correct and why others are distractors."
    }
  ]
}

### OUTPUT
Return STRICT JSON. No prose.
`;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function generateQuestionBank() {
  console.log(`🤖 Starting Strict Scaffolding Question Bank generation...`);
  
  let totalStored = 0;

  for (const level of LEVELS) {
    for (const skill of SKILLS) {
      const topics = TOPIC_MAP[level]?.[skill] || [skill];
      
      for (const topic of topics) {
        console.log(`\n⏳ Generating [${level} - ${skill}] Block: ${topic}...`);
        
        const promptText = generatePrompt(level, skill, topic);

        try {
          const response = await llmClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are an expert language assessment JSON generator. Focus on pedagogical progression." },
              { role: "user", content: promptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3, // Lower temp for more deterministic logic
          });

          const rawText = response.choices[0]?.message?.content;
          if (!rawText) throw new Error("Empty response");

          const parsedData = JSON.parse(rawText);
          if (!Array.isArray(parsedData.questions)) throw new Error("Missing questions array");

          console.log(`✅ Received ${parsedData.questions.length} questions for topic: ${topic}.`);

          const stimulus = parsedData.shared_stimulus?.text || null;
          let successCount = 0;

          for (let i = 0; i < parsedData.questions.length; i++) {
            const q = parsedData.questions[i];
            
            // Programmatic Difficulty: Ensure spread (Easy, Med, Med, Hard)
            const diffs = [0.2, 0.45, 0.65, 0.85];
            const difficulty = diffs[i] || 0.5;
            
            // Systematic External ID: SKILL-LEVEL-TOPIC-INDEX
            const topicId = topic.replace(/\s+/g, '-').toUpperCase().substring(0, 10);
            const externalId = `${skill.substring(0, 4).toUpperCase()}-${level}-${topicId}-${Date.now().toString().slice(-4)}-Q${i+1}`;

            const payload = {
              external_id: externalId,
              skill: skill.toLowerCase(),
              task_type: TASK_FORMAT,
              level,
              difficulty,
              prompt: q.question_text,
              stimulus,
              answer_key: {
                options: q.options,
                correct: q.correct_answer,
                explanation: q.explanation,
                topic: topic
              }
            };

            await supabase
              .from('question_bank_items')
              .insert({
                external_id: payload.external_id,
                skill: payload.skill,
                task_type: payload.task_type,
                level: payload.level,
                difficulty: payload.difficulty,
                prompt: payload.prompt,
                stimulus: payload.stimulus,
                answer_key: payload.answer_key
              });

            successCount++;
          }
          
          totalStored += successCount;
          console.log(`✅ Stored ${successCount} questions for [${topic}].`);
          await delay(2000); 

        } catch (err: any) {
          console.error(`❌ Failed for [${topic}]:`, err.message);
          await delay(5000);
        }
      }
    }
  }

  console.log(`\n🎉 Completed! Stored ${totalStored} questions into the bank.`);
}

generateQuestionBank();
