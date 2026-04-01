import { AssessmentQuestion } from '../types/assessment';
import { DescriptorService } from './DescriptorService';
import { LLMConfig, ClientCircuitBreaker } from '../config/backend-config';

export type DifficultyAction = 'increase' | 'stay' | 'decrease';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type DescriptorEvaluationResult = {
  isMatch: boolean;
  matchedBand: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  confidence: ConfidenceLevel;
  difficultyAction: DifficultyAction;
  strengths: string[];
  weaknesses: string[];
  reasons: string[];
  linguisticDepthScore?: number;
  domainAuthorityScore?: number;
  outputCefrMapping?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
};

export class GroqEvaluationService {
  private static readonly GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';


  private static getNearbyBands(currentBand: string): string[] {
    const bands = ['Pre-A1', 'A1', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'];
    const idx = bands.indexOf(currentBand);
    if (idx === -1) return ['A1', 'A2', 'B1']; 

    const subset = [currentBand];
    if (idx > 0) subset.push(bands[idx - 1]);
    if (idx < bands.length - 1) subset.push(bands[idx + 1]);
    // Expand to +2 for diagnostic flexibility
    if (idx < bands.length - 2) subset.push(bands[idx + 2]);
    
    return subset;
  }

  /**
   * Evaluates a learner response against CEFR descriptors using Groq.
   * STRICT FAIL-SAFE: Returns null if API is down, allowing engine to use deterministic fallback.
   */
  public static async evaluateAnswer(
    question: AssessmentQuestion,
    answer: string,
    currentBand: string
  ): Promise<DescriptorEvaluationResult | null> {
    // Gate 1: Circuit breaker
    if (ClientCircuitBreaker.isOpen()) {
      console.log('[GroqEvaluator] Circuit breaker OPEN. Skipping LLM enrichment.');
      return null;
    }

    const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
    
    if (!apiKey) {
      console.warn('[GroqEvaluator] VITE_GROQ_API_KEY is not set. Deterministic fallback enabled.');
      return null;
    }

    try {
      const descriptorService = DescriptorService.getInstance();
      await descriptorService.initialize();

      const targetBands = this.getNearbyBands(currentBand);
      let skillIdentifier = question.skill;
      if (skillIdentifier === 'grammar' || skillIdentifier === 'vocabulary') {
          skillIdentifier = question.primarySkill || question.skill; 
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const relevantDescriptors = descriptorService.getRelevantDescriptors(skillIdentifier, targetBands);

      if (relevantDescriptors.length === 0) return null;

      const descriptorsJson = JSON.stringify(relevantDescriptors.map(d => ({
        level: d.level,
        descriptor: d.descriptor
      })));

      const systemPrompt = `You are a Senior Linguistic Data Scientist evaluating a learner's response. Your task is to evaluate not just for accuracy, but for 'Latent Semantic Proficiency' (LSP).
Your ONLY job is to compare the learner's answer against the exact CEFR descriptors provided, and return a strict JSON evaluation.

# EVALUATION PROTOCOL:
1. **Divergence Check (Input vs. Output):** If the prompt is simple (e.g. A1) but the user responds with advanced syntax (C1), you MUST anchor the \`matchedBand\` and \`outputCefrMapping\` to the OUTPUT complexity, regardless of the prompt's difficulty.
2. **Metric - Lexical Density & Rarefaction:** Heavily weight the presence of low-frequency tokens and high content-word density.
3. **Metric - Syntactic Depth:** Heavily weight subordinate clauses, passive voice, and gerund phrases. If the user manages 3+ levels of nested logic, bypass B-level descriptors entirely.
4. **Constraint - Semantic Consistency:** A correct simple-question answer with advanced free-text proves mastery. Do NOT penalize advanced users for answering a simple question correctly.

# REQUIRED JSON SCHEMA:
{
  "isMatch": boolean,
  "matchedBand": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "confidence": "high" | "medium" | "low",
  "difficultyAction": "increase" | "stay" | "decrease",
  "strengths": string[],
  "weaknesses": string[],
  "reasons": string[],
  "linguisticDepthScore": number (0.0 - 1.0),
  "domainAuthorityScore": number (0.0 - 1.0),
  "outputCefrMapping": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
}

# PROVIDED CEFR DESCRIPTORS:
${descriptorsJson}
`;

      const userPrompt = `Target Question Band: ${currentBand}
Question Prompt: "${question.prompt}"

# Learner's Answer:
"${answer}"

Evaluate the answer. Return ONLY the strict JSON object.`;

      console.log(`[GroqEvaluator] Attempting LLM enrichment with ${LLMConfig.model}...`);
      
      const response = await fetch(this.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: LLMConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 512,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errMsg = err.error?.message || response.statusText;
        console.error(`[GroqEvaluator] API Error: ${errMsg}`);
        ClientCircuitBreaker.recordFailure(`GroqDirect: ${errMsg}`);
        return null; // Fail safe
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) return null;

      const result = JSON.parse(content) as DescriptorEvaluationResult;
      
      // Secondary validation of JSON integrity
      if (!result.matchedBand || !['high', 'medium', 'low'].includes(result.confidence)) {
        console.error('[GroqEvaluator] Invalid JSON structure from LLM');
        ClientCircuitBreaker.recordFailure('Invalid JSON structure from direct Groq call');
        return null;
      }
      
      ClientCircuitBreaker.recordSuccess();
      return result;

    } catch (error) {
      console.error('[GroqEvaluator] Unexpected execution error:', error);
      ClientCircuitBreaker.recordFailure(String(error));
      return null; // Fail safe to deterministic logic
    }
  }
}
