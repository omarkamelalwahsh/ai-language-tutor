import { LLMConfig, ClientCircuitBreaker } from '../config/backend-config';

export type JourneyNodeInput = {
  currentLevel: string;
  targetLevel: string;
  gaps: string[];
  recentPerformance: string;
};

export type LLMJourneyNode = {
  id: string;
  type: "REMEDIATION" | "PROGRESSION" | "CHECKPOINT";
  title: string;
  description: string;
  skills: string[];
  difficulty: number;
  icon: string;
};

export class InferenceGateway {
  private static readonly SYSTEM_PROMPT = `
### Role
You are an expert AI Learning Architect. Your goal is to design a personalized, high-impact "Learner Journey Roadmap" that guides a user from their current CEFR level to their target level.

### Logic Constraints
1. **Remediation First:** Always start by placing "Remediation" nodes that directly address the user's specific weaknesses.
2. **The Leapfrog Logic:** If the gap between current and target level is wide (e.g., B1 to C1), ensure the "Progression" nodes introduce "Bridge Competencies" that focus on advanced syntactic complexity and lexical nuance.
3. **Checkpoints:** Place a "CHECKPOINT" node every 3 progression nodes to simulate a "Real-World Assessment".
4. **Tone:** Professional, encouraging, and highly analytical. Keep descriptions actionable (e.g., "Master the nuance of X" rather than "Learn about X").
5. **Efficiency:** Do not suggest redundant tasks. Focus on high-leverage linguistic points that offer the most progress for the least time.

### Output Schema (JSON Format)
Return a JSON array of 'nodes' representing the roadmap:
{
  "nodes": [
    {
      "id": "string",
      "type": "REMEDIATION | PROGRESSION | CHECKPOINT",
      "title": "bridge: string",
      "description": "string (Short, motivational, and technical)",
      "skills": ["speaking", "writing", "grammar"],
      "difficulty": "1-5",
      "icon": "string (e.g., 'mic', 'pen', 'lightbulb')"
    }
  ]
}
`;

  public static async generateJourney(input: JourneyNodeInput): Promise<{ nodes: LLMJourneyNode[] } | null> {
    if (ClientCircuitBreaker.isOpen()) return null;

    const userPrompt = `
- User Current Level: ${input.currentLevel}
- Target Level: ${input.targetLevel}
- Identified Weaknesses (Gaps): ${input.gaps.join(', ')}
- Recent Performance: ${input.recentPerformance}
    `;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLMConfig.requestTimeoutMs);

      const res = await fetch(`${LLMConfig.backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: this.SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        ClientCircuitBreaker.recordFailure(`HTTP ${res.status} during journey generation.`);
        return null;
      }

      const data = await res.json();
      ClientCircuitBreaker.recordSuccess();
      
      // Handle different LLM response formats (OpenAI/Groq often wrap in choices)
      const result = data.choices ? JSON.parse(data.choices[0].message.content) : data;
      return result;

    } catch (err) {
      console.error("[InferenceGateway] Journey generation failed:", err);
      ClientCircuitBreaker.recordFailure(String(err));
      return null;
    }
  }
}
