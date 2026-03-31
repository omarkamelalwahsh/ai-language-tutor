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

      const systemPrompt = `You are a strict, objective linguistic evaluator.
Your ONLY job is to compare the learner's answer against the exact CEFR descriptors provided, and return a strict JSON evaluation.

# RULES:
1. ONLY return a syntactically valid JSON object. No markdown blocks, no preamble, no prose.
2. DO NOT hallucinate rules. Use ONLY the provided descriptors to justify your level matching.
3. DO NOT overestimate. If an answer matches the lower level fully but the higher level only partially, MATCH THE LOWER LEVEL.
4. If the answer is too short, generic, or incomplete to confidently judge against the descriptors, output "confidence": "low" and "difficultyAction": "stay".

# REQUIRED JSON SCHEMA:
{
  "isMatch": boolean,
  "matchedBand": string,
  "confidence": "high" | "medium" | "low",
  "difficultyAction": "increase" | "stay" | "decrease",
  "strengths": string[],
  "weaknesses": string[],
  "reasons": string[]
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
