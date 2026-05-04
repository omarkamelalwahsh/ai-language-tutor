import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface TaskEvaluationResponse {
  score: number;
  is_correct: boolean;
  detailed_feedback: string;
  error_analysis: {
    detected_errors: string[];
    corrected_version: string;
  };
  metrics: {
    grammar_score: number;
    relevance_score: number;
  };
  bridge_percentage?: number;
}

export const assessmentService = {
  // 🎯 Fetch a new dynamic task from Groq
  generateTask: async (userId: string, taskId: string) => {
    const response = await axios.get(`${API_URL}/assessments/generate-task`, {
      params: { user_id: userId, task_id: taskId }
    });
    return response.data;
  },

  // 🎯 NEW: Generate a highly personalized task using AI Task Architect
  generateDynamicTask: async (type: string = 'WORD_BUILDER') => {
    // Assuming the user_id is handled by the backend from the token
    const response = await axios.post(`${API_URL}/tasks/generate?type=${type}`);
    return response.data;
  },

  // 🎯 Submit, Evaluate and Sync in ONE go (Using the orchestrator in backend)
  submitDynamicTask: async (
    userId: string,
    taskId: string,
    responseText: string
  ): Promise<TaskEvaluationResponse> => {
    try {
      const response = await axios.post(`${API_URL}/assessments/submit-task`, {
        user_id: userId,
        task_id: taskId,
        response_text: responseText
      });
      return response.data;
    } catch (error) {
      console.error('Error in Task Orchestration:', error);
      throw error;
    }
  },

  // 🎯 Compatibility helper (in case some old code calls it)
  submitTaskOutcome: async (
    userId: string,
    taskId: string,
    evaluation: TaskEvaluationResponse
  ) => {
     // Already handled by submitDynamicTask in this architecture
     return { status: "already_synced" };
  }
};
