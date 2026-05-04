import React from 'react';
import AdaptiveTaskCard from '../components/assessment/AdaptiveTaskCard';
import { useData } from '../context/DataContext';

const TaskEngineDemoView: React.FC = () => {
  const { user } = useData();

  // Mock data for the demo
  const mockTask = {
    id: "demo-task-uuid",
    prompt: "Write a short business email to apologize for a missed meeting using the Present Perfect.",
    stimulus: "Scenario: You were supposed to meet a potential client last Tuesday but couldn't make it. The client is now asking for an update."
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
          Task Engine Demo
        </h1>
        <p className="text-white/40">Testing Model 3 (Generator) & Model 2 (Evaluator) Integration</p>
      </div>

      <AdaptiveTaskCard
        userId={user?.id || "demo-user"}
        onComplete={(result) => {
          console.log("Evaluation received:", result);
        }}
      />

      <div className="mt-12 max-w-2xl w-full p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
        <h4 className="text-white/80 font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            System Instructions
        </h4>
        <div className="space-y-3 text-sm text-white/50 leading-relaxed">
            <p>1. <strong>Task Engine (M3):</strong> Generated the prompt and rubric above.</p>
            <p>2. <strong>Evaluator (M2):</strong> Will grade your response against the specific B1 Present Perfect criteria.</p>
            <p>3. <strong>Database Sync:</strong> Your accuracy and bridge progress will be updated in real-time.</p>
        </div>
      </div>
    </div>
  );
};

export default TaskEngineDemoView;
