import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testData = {
  "item_bank": [
    {
      "id": "e7b1a0f9-2c4d-4e8a-8a5f-9b1c2d3e4f5a",
      "skill": "reading",
      "tier": "Tier 1",
      "target_CEFR_level": "A2",
      "instructions_to_user": "Read the first section of the AuroLogistics report and answer the questions.",
      "stimulus": "### AuroLogistics Global Operations & ESG Strategy 2024\n\n**Section 1: General Office Introduction**\nWelcome to our London office. AuroLogistics is a large company with 500 employees. Our office is open from 08:30 to 17:30. Most people work in the main building. There is a small kitchen on every floor for coffee and tea. We have a weekly meeting every Monday morning at 09:00 to talk about our tasks. Please remember to wear your security badge at all times. If you have questions about your desk or computer, speak to our IT support team in Room 102.",
      "questions": [
        {
          "question_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
          "question_type": "MCQ single-select",
          "question_text": "What time does the weekly team meeting start?",
          "options": [
            { "label": "A", "text": "08:30" },
            { "label": "B", "text": "09:00" },
            { "label": "C", "text": "10:00" },
            { "label": "D", "text": "17:30" }
          ],
          "correct_answer": "09:00",
          "explanation_for_correct": "The text states the weekly meeting is 'every Monday morning at 09:00'.",
          "distractor_rationales": {
            "A": "08:30 is when the office opens, not the meeting time.",
            "C": "10:00 is not mentioned in the text.",
            "D": "17:30 is when the office closes."
          }
        },
        {
          "question_id": "b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e",
          "question_type": "MCQ single-select",
          "question_text": "Who should an employee contact for issues with their computer?",
          "options": [
            { "label": "A", "text": "The Security Team" },
            { "label": "B", "text": "The Floor Manager" },
            { "label": "C", "text": "The Kitchen Staff" },
            { "label": "D", "text": "The IT Support Team" }
          ],
          "correct_answer": "The IT Support Team",
          "explanation_for_correct": "The text says to 'speak to our IT support team in Room 102' for computer questions.",
          "distractor_rationales": {
            "A": "Security badges are mentioned, but not IT support roles.",
            "B": "Managers are not mentioned in this context.",
            "C": "Kitchens are mentioned for coffee, not for computer help."
          }
        },
        {
          "question_id": "c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f",
          "question_type": "MCQ single-select",
          "question_text": "Complete the sentence with the correct grammar: In our office, there ____ many desks on each floor.",
          "options": [
            { "label": "A", "text": "is" },
            { "label": "B", "text": "am" },
            { "label": "C", "text": "are" },
            { "label": "D", "text": "be" }
          ],
          "correct_answer": "are",
          "explanation_for_correct": "'Are' is used with plural nouns like 'desks'.",
          "distractor_rationales": {
            "A": "'Is' is for singular nouns.",
            "B": "'Am' is only for 'I'.",
            "D": "'Be' is the base form and requires conjugation here."
          }
        }
      ]
    },
    {
      "id": "f8c2b1a0-3d5e-5f9b-9b6c-0c2d3e4f5a6b",
      "skill": "reading",
      "tier": "Tier 2",
      "target_CEFR_level": "B2",
      "instructions_to_user": "Review the section on Regional Expansion and answer the following questions.",
      "stimulus": "### AuroLogistics Global Operations & ESG Strategy 2024\n\n**Section 2: Regional Expansion and Employee Retention**\nDespite the economic downturn, AuroLogistics has successfully expanded its operations across the East Midlands. This growth, however, has highlighted a significant challenge in staff retention. While we have implemented more flexible working patterns, several branch managers have expressed concerns regarding the increasing workloads. If we had predicted the surge in demand last August, we would have hired more part-time contractors. Currently, our priority is to streamline the internal logistics chain to ensure that resources are distributed efficiently. This shift requires every department to collaborate more closely than they did in previous years. Employees who demonstrate consistent high performance will likely be fast-tracked to senior management roles by the end of the second quarter.",
      "questions": [
        {
          "question_id": "d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8a",
          "question_type": "MCQ single-select",
          "question_text": "According to the text, what is the main consequence of the recent company growth?",
          "options": [
            { "label": "A", "text": "A reduction in overall workload for managers." },
            { "label": "B", "text": "Difficulties in keeping staff members in the company." },
            { "label": "C", "text": "A decision to move all operations to the East Midlands." },
            { "label": "D", "text": "The immediate dismissal of part-time contractors." }
          ],
          "correct_answer": "Difficulties in keeping staff members in the company.",
          "explanation_for_correct": "The text mentions a 'significant challenge in staff retention' as a result of the growth.",
          "distractor_rationales": {
            "A": "Managers have expressed 'concerns regarding the increasing workloads', not a reduction.",
            "C": "Growth happened there, but it wasn't a total relocation of 'all' operations.",
            "D": "The text says they *would have* hired them, implying they currently lack them."
          }
        },
        {
          "question_id": "e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8a9b",
          "question_type": "MCQ single-select",
          "question_text": "Which grammatical structure in the text indicates a regret about a past situation?",
          "options": [
            { "label": "A", "text": "'Current priority is to streamline...'" },
            { "label": "B", "text": "'Employees who demonstrate consistent high performance...'" },
            { "label": "C", "text": "'If we had predicted the surge... we would have hired...'" },
            { "label": "D", "text": "'This shift requires every department...'" }
          ],
          "correct_answer": "'If we had predicted the surge... we would have hired...'",
          "explanation_for_correct": "This is a Third Conditional structure, used to express regret or hypothetical situations in the past.",
          "distractor_rationales": {
            "A": "This is a statement of present fact/priority.",
            "B": "This is a prediction about the future.",
            "D": "This is a statement about current requirements."
          }
        },
        {
          "question_id": "f6a7b8c9-d0e1-4f0a-3b4c-5d6e7f8a9b0c",
          "question_type": "MCQ single-select",
          "question_text": "What does the text suggest is necessary for the new 'streamlining' to work?",
          "options": [
            { "label": "A", "text": "Hiring external consultants to oversee the shift." },
            { "label": "B", "text": "Reducing the number of senior management roles." },
            { "label": "C", "text": "Increased inter-departmental cooperation." },
            { "label": "D", "text": "Moving to a strict five-day office schedule." }
          ],
          "correct_answer": "Increased inter-departmental cooperation.",
          "explanation_for_correct": "The text states: 'This shift requires every department to collaborate more closely'.",
          "distractor_rationales": {
            "A": "Consultants are not mentioned.",
            "B": "The text mentions 'senior management roles' as potential promotions, not reductions.",
            "D": "Flexible working patterns were already mentioned as being implemented."
          }
        }
      ]
    },
    {
      "id": "a9b8c7d6-e5f4-3d2c-1b0a-9f8e7d6c5b4a",
      "skill": "reading",
      "tier": "Tier 3",
      "target_CEFR_level": "C1",
      "instructions_to_user": "Analyse the strategic section of the ESG report and answer the critical thinking questions.",
      "stimulus": "### AuroLogistics Global Operations & ESG Strategy 2024\n\n**Section 3: Geopolitical Volatility and Carbon Credit Geopolitics**\nThe current fiscal year has been defined by an unprecedented degree of geopolitical volatility, necessitating a fundamental recalibration of our ESG (Environmental, Social, and Governance) framework. AuroLogistics finds itself at the nexus of a complex carbon trading landscape, where the shifting sands of international policy directly impact the viability of our long-haul fleet. It is no longer sufficient to merely comply with local emissions standard; rather, we must pre-emptively adopt a carbon-positive stance to insulate our stakeholders from the impending regulatory squeeze in the Eurozone. Critics might argue that such a radical shift in capital allocation risks alienating short-term investors. However, given the correlation between long-term sustainability metrics and market resilience, the Board maintains that this proactive expenditure is not only ethically defensible but commercially imperative. The nuance of this strategy lies in our ability to synthesise data from disparate regional centres into a unified reporting mechanism that withstands the scrutiny of increasingly cynical institutional investors.",
      "questions": [
        {
          "question_id": "g7h8i9j0-k1l2-4m3n-5o4p-6q5r7s8t9u0v",
          "question_type": "MCQ single-select",
          "question_text": "What is the primary justification for the Board's decision to adopt a 'carbon-positive stance'?",
          "options": [
            { "label": "A", "text": "To strictly follow existing local environmental laws." },
            { "label": "B", "text": "To protect the company from future legal and regulatory controls in Europe." },
            { "label": "C", "text": "To satisfy the demands of short-term investors for immediate dividends." },
            { "label": "D", "text": "To reduce the complexity of data synthesising in regional centres." }
          ],
          "correct_answer": "To protect the company from future legal and regulatory controls in Europe.",
          "explanation_for_correct": "The text mentions adopting this stance to 'insulate our stakeholders from the impending regulatory squeeze in the Eurozone'.",
          "distractor_rationales": {
            "A": "The text says compliance with local laws is 'no longer sufficient'.",
            "C": "The text explicitly acknowledges that this strategy might 'alienate' such investors.",
            "D": "Synthesising data is mentioned as a method for reporting, not a reason for the carbon stance."
          }
        },
        {
          "question_id": "h8i9j0k1-l2m3-4n4o-5p5q-6r6s7t8u9v0w",
          "question_type": "MCQ single-select",
          "question_text": "What tone does the phrase 'shifting sands of international policy' convey in this context?",
          "options": [
            { "label": "A", "text": "Optimism regarding the stability of global trade." },
            { "label": "B", "text": "Indifference to the needs of the long-haul fleet." },
            { "label": "C", "text": "A sense of unpredictability and risk." },
            { "label": "D", "text": "Confidence in the Eurozone's regulatory clarity." }
          ],
          "correct_answer": "A sense of unpredictability and risk.",
          "explanation_for_correct": "'Shifting sands' is an idiom used to describe a situation that is constantly changing and unreliable.",
          "distractor_rationales": {
            "A": "The phrase suggests the opposite of stability.",
            "B": "The policy directly 'impacts the viability' of the fleet, showing high concern, not indifference.",
            "D": "The text refers to a 'squeeze' and 'volatility', not clarity."
          }
        },
        {
          "question_id": "i9j0k1l2-m3n4-5o5p-6q6r-7s7t8u9v0w1x",
          "question_type": "MCQ single-select",
          "question_text": "In the sentence 'critics might argue that...', what is the function of the word 'might'?",
          "options": [
            { "label": "A", "text": "To state a proven fact about investor behaviour." },
            { "label": "B", "text": "To grant permission for people to complain." },
            { "label": "C", "text": "To introduce a hypothetical counter-argument." },
            { "label": "D", "text": "To express an obligation for the Board to change its mind." }
          ],
          "correct_answer": "To introduce a hypothetical counter-argument.",
          "explanation_for_correct": "'Might' is used here to anticipate and acknowledge a potential criticism before refuting it.",
          "distractor_rationales": {
            "A": "It indicates possibility/hypothesis, not a definite fact.",
            "B": "This is a formal report, not a context of granting permission.",
            "D": "'Might' does not carry the sense of 'must' or 'should'."
          }
        }
      ]
    },
    {
      "id": "j0k1l2m3-n4o5-6p6q-7r7s-8t8u9v0w1x2y",
      "skill": "listening",
      "tier": "Tier 1",
      "target_CEFR_level": "A2",
      "instructions_to_user": "Listen to the conversation between two office workers and answer the questions.",
      "stimulus": "### Audio Script 1: The New Schedule\n\n**Sarah:** Hi Mark, did you see the new office email?\n**Mark:** No, Sarah. What does it say?\n**Sarah:** Starting next month, we can choose our own start time. We just have to be in the building between 10:00 and 15:00.\n**Mark:** That's great! I can finally eat breakfast with my kids. What about the Friday meeting?\n**Sarah:** That stays the same. Friday at 16:00 in the main boardroom.\n**Mark:** Okay, thanks Sarah. I need to update my calendar now.",
      "questions": [
        {
          "question_id": "k1l2m3n4-o5p6-7q7r-8s8t-9u9v0w1x2y3z",
          "question_type": "MCQ single-select",
          "question_text": "What is changing in the office next month?",
          "options": [
            { "label": "A", "text": "The location of the building." },
            { "label": "B", "text": "The price of breakfast." },
            { "label": "C", "text": "The start time for work." },
            { "label": "D", "text": "The date of the Friday meeting." }
          ],
          "correct_answer": "The start time for work.",
          "explanation_for_correct": "Sarah says: 'we can choose our own start time'.",
          "distractor_rationales": {
            "A": "Not mentioned.",
            "B": "Breakfast is mentioned in a personal context, not as a change.",
            "D": "The meeting 'stays the same'."
          }
        },
        {
          "question_id": "l2m3n4o5-p6q7-8r8s-9t9u-0v0w1x2y3z4a",
          "question_type": "MCQ single-select",
          "question_text": "Between which times must everyone be in the office?",
          "options": [
            { "label": "A", "text": "08:00 and 17:00" },
            { "label": "B", "text": "10:00 and 15:00" },
            { "label": "C", "text": "09:00 and 16:00" },
            { "label": "D", "text": "12:00 and 13:00" }
          ],
          "correct_answer": "10:00 and 15:00",
          "explanation_for_correct": "Sarah says: 'be in the building between 10:00 and 15:00'.",
          "distractor_rationales": {
            "A": "Generic office hours, not the new core hours.",
            "C": "Meeting time is 16:00, not core hours.",
            "D": "Typically lunch hours, but not the ones mentioned."
          }
        },
        {
          "question_id": "m3n4o5p6-q7r8-9s9t-0u0v-1w1x2y3z4a5b",
          "question_type": "MCQ single-select",
          "question_text": "Where is the Friday meeting held?",
          "options": [
            { "label": "A", "text": "In the office kitchen." },
            { "label": "B", "text": "In the main boardroom." },
            { "label": "C", "text": "Online via video call." },
            { "label": "D", "text": "At Mark's house." }
          ],
          "correct_answer": "In the main boardroom.",
          "explanation_for_correct": "Sarah states: 'in the main boardroom'.",
          "distractor_rationales": {
            "A": "Kitchens exist but meetings are in boardrooms.",
            "C": "Not mentioned.",
            "D": "Mark is talking about his family, not working from home."
          }
        }
      ]
    },
    {
      "id": "p6o5n4m3-l2k1-0j9i-8h7g-6f5e4d3c2b1a",
      "skill": "writing",
      "tier": "Tier 1",
      "target_CEFR_level": "A2",
      "instructions_to_user": "Write a short email (50-70 words) to your new manager according to the Section 1 of the report.",
      "stimulus": "Scenario: You are a new employee at AuroLogistics. You need to ask for a new security badge and ask where the IT support team is located.",
      "answer_key": { "rubric": "writing_analytic_diagnostic_t1" }
    },
    {
      "id": "q7r8s9t0-u1v2-w3x4-y5z6-a7b8c9d0e1f2",
      "skill": "speaking",
      "tier": "Tier 3",
      "target_CEFR_level": "C2",
      "instructions_to_user": "Record a formal response (2-3 minutes) based on the Section 3 analysis.",
      "stimulus": "Prompt: You are a Senior Consultant advising the Board of AuroLogistics. Summarise the risks of the proposed 'carbon-positive' strategy and provide your recommendation on how to justify this to short-term investors. Use advanced professional register.",
      "answer_key": { "rubric": "speaking_analytic_diagnostic_t3" }
    }
  ]
};

async function seedMasterTest() {
  console.log('🚀 Seeding Professional CEFR Placement Test...');
  
  for (const item of testData.item_bank) {
    // For tasks with questions (Reading/Listening), we create an entry for each question
    if (item.questions) {
      for (const q of item.questions) {
        const payload = {
          external_id: q.question_id,
          skill: item.skill,
          task_type: 'passage_bundle',
          level: item.target_CEFR_level,
          difficulty: item.tier === 'Tier 1' ? 0.35 : (item.tier === 'Tier 2' ? 0.65 : 0.9),
          prompt: q.question_text,
          stimulus: item.stimulus,
          answer_key: {
            options: q.options.map(o => o.text),
            correct: q.correct_answer,
            explanation: q.explanation_for_correct,
            distractor_rationales: q.distractor_rationales
          }
        };

        const { error } = await supabase.from('question_bank_items').insert(payload);
        if (error) console.error(`❌ Failed to insert question ${q.question_id}:`, error.message);
        else console.log(`✅ Inserted MCQ: ${q.question_id} (${item.skill})`);
      }
    } else {
      // For Open-Ended tasks (Writing/Speaking)
      const payload = {
        external_id: item.id,
        skill: item.skill,
        task_type: item.skill === 'writing' ? 'typed' : 'audio',
        level: item.target_CEFR_level,
        difficulty: item.tier === 'Tier 1' ? 0.35 : (item.tier === 'Tier 2' ? 0.65 : 0.9),
        prompt: item.instructions_to_user,
        stimulus: item.stimulus,
        answer_key: item.answer_key
      };

      const { error } = await supabase.from('question_bank_items').insert(payload);
      if (error) console.error(`❌ Failed to insert task ${item.id}:`, error.message);
      else console.log(`✅ Inserted Task: ${item.id} (${item.skill})`);
    }
  }
  
  console.log('🎉 Seeding complete!');
}

seedMasterTest();
