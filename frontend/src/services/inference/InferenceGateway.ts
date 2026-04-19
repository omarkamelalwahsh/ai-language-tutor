// تعريف الموديلات بناءً على التخصص
export enum AIModelType {
  SMART = 'SMART', // Llama-3-70b (للتحليل العميق والـ Journey)
  FAST = 'FAST'    // Llama-3-8b (للردود السريعة وتصحيح الأسئلة)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class InferenceGateway {
  // بنكلم الـ Proxy بتاعنا على Vercel مش Groq مباشرة
  private static get PROXY_ENDPOINT() {
    return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/chat` : '/api/chat';
  }

  /**
   * الدالة الرئيسية لطلب الرد من الـ AI
   */
  public static async getCompletion(
    messages: ChatMessage[],
    type: AIModelType = AIModelType.FAST
  ) {
    try {
      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          modelType: type, // بنبعت النوع والـ Proxy هو اللي يحدد الموديل
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from AI Proxy');
      }

      const data = await response.json();
      
      // التعامل مع Format الـ OpenAI/Groq اللي بيرجع من الـ Proxy
      return data.choices[0].message.content;
    } catch (error) {
      console.error('InferenceGateway Error:', error);
      throw error;
    }
  }

  /**
   * دالة مخصصة لتوليد الـ Journey (تستخدم الـ SMART Model)
   */
  public static async generateJourney(prompt: string) {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an expert curriculum architect. Generate a learning journey in JSON format. Do not use quotes or backticks. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ];
    return this.getCompletion(messages, AIModelType.SMART);
  }

  /**
   * دالة مخصصة لتقييم إجابة (تستخدم الـ FAST Model)
   */
  public static async evaluateAnswer(question: string, userAnswer: string) {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a precise language tutor. Evaluate the following answer briefly. Return valid JSON.' },
      { role: 'user', content: `Question: ${question}\nUser Answer: ${userAnswer}` }
    ];
    return this.getCompletion(messages, AIModelType.FAST);
  }
}

export default InferenceGateway;
