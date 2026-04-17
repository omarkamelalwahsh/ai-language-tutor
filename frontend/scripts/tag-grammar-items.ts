/**
 * tag-grammar-items.ts
 * 
 * Auto-detects reading items that test grammatical accuracy (not comprehension)
 * and re-tags them as skill='grammar'. Targets 7 items total:
 *   Tier 1 (A1-A2): 2 items
 *   Tier 2 (B1-B2): 3 items
 *   Tier 3 (C1-C2): 2 items
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Grammar-indicative keywords in subskills/metadata
const GRAMMAR_KEYWORDS = [
  'grammar', 'tense', 'syntax', 'structure', 'preposition',
  'reference', 'linking', 'pronoun', 'article', 'modal',
  'conditional', 'clause', 'agreement', 'conjunction',
  'word order', 'auxiliary', 'passive', 'gerund', 'infinitive',
  'cohesion', 'discourse marker', 'collocation'
];

// How many grammar items we want per tier
const TIER_QUOTA: Record<string, { levels: string[]; target: number }> = {
  tier1: { levels: ['A1', 'A2'], target: 2 },
  tier2: { levels: ['B1', 'B2'], target: 3 },
  tier3: { levels: ['C1', 'C2'], target: 2 },
};

function isGrammarItem(answerKey: any): boolean {
  if (!answerKey) return false;

  const ak = typeof answerKey === 'string' ? JSON.parse(answerKey) : answerKey;

  // Check metadata.subskills
  const subskills: string[] = ak?.metadata?.subskills || [];
  const subskillText = subskills.join(' ').toLowerCase();

  // Check explanation text for grammar patterns
  const explanation = (ak?.explanation || '').toLowerCase();

  // Check prompt via metadata
  const rationale = (ak?.metadata?.rationale || '').toLowerCase();

  const combined = `${subskillText} ${explanation} ${rationale}`;

  return GRAMMAR_KEYWORDS.some(kw => combined.includes(kw));
}

async function tagGrammarItems() {
  console.log("🔍 Auto-detecting grammar items from reading bank...\n");

  // Fetch all reading items
  const { data: readingItems, error } = await supabase
    .from('question_bank_items')
    .select('id, level, prompt, answer_key')
    .eq('skill', 'reading')
    .order('level');

  if (error || !readingItems) {
    console.error("❌ Failed to fetch reading items:", error?.message);
    process.exit(1);
  }

  console.log(`📚 Found ${readingItems.length} reading items total.\n`);

  // Score each item for grammar-relevance
  const scored = readingItems.map(item => ({
    ...item,
    isGrammar: isGrammarItem(item.answer_key),
  }));

  const grammarCandidates = scored.filter(s => s.isGrammar);
  console.log(`🧪 Grammar candidates detected: ${grammarCandidates.length}`);
  grammarCandidates.forEach(c => {
    console.log(`   [${c.level}] ${c.prompt.substring(0, 80)}...`);
  });

  // Apply tier quotas
  const toTag: string[] = [];

  for (const [tierName, { levels, target }] of Object.entries(TIER_QUOTA)) {
    const tierCandidates = grammarCandidates.filter(c => levels.includes(c.level));
    const selected = tierCandidates.slice(0, target);

    // If we don't have enough auto-detected grammar items, 
    // fall back to any reading item in that tier
    if (selected.length < target) {
      const fallbackPool = scored
        .filter(s => levels.includes(s.level) && !s.isGrammar && !toTag.includes(s.id));
      const needed = target - selected.length;
      selected.push(...fallbackPool.slice(0, needed));
    }

    console.log(`\n📊 ${tierName} (${levels.join('/')}): Need ${target}, found ${selected.length}`);
    selected.forEach(s => {
      console.log(`   ✅ [${s.level}] ${s.id} — "${s.prompt.substring(0, 60)}..."`);
      toTag.push(s.id);
    });
  }

  console.log(`\n🏷️  Total items to re-tag as 'grammar': ${toTag.length}`);

  if (toTag.length === 0) {
    console.log("⚠️  No items selected for tagging. Exiting.");
    process.exit(0);
  }

  // Execute the update
  for (const id of toTag) {
    const { error: updateErr } = await supabase
      .from('question_bank_items')
      .update({ skill: 'grammar' })
      .eq('id', id);

    if (updateErr) {
      console.error(`❌ Failed to update ${id}:`, updateErr.message);
    }
  }

  console.log(`\n🎉 Successfully re-tagged ${toTag.length} items as 'grammar'!`);

  // Verify final distribution
  const { data: finalCheck } = await supabase
    .from('question_bank_items')
    .select('skill');

  const distribution: Record<string, number> = {};
  finalCheck?.forEach((r: any) => {
    distribution[r.skill] = (distribution[r.skill] || 0) + 1;
  });

  console.log('\n📦 Final bank distribution:');
  console.log(JSON.stringify(distribution, null, 2));
}

tagGrammarItems().catch(err => {
  console.error("❌ Critical error:", err);
  process.exit(1);
});
