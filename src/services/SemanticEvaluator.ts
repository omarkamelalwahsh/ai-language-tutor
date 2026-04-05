import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';

// Workaround for some node/edge environments where local model fetching throws warnings
env.allowLocalModels = false;
env.useBrowserCache = false;

export class SemanticEvaluator {
  private static instance: FeatureExtractionPipeline | null = null;
  private static initPromise: Promise<FeatureExtractionPipeline> | null = null;

  /**
   * Initializes the Transformers.js pipeline using the all-MiniLM-L6-v2 model.
   * Caches the instance singleton style.
   */
  public static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance) return this.instance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true, // Use int8 quantized version (smaller, ~22MB)
    }).then(pipe => {
      this.instance = pipe as FeatureExtractionPipeline;
      return this.instance;
    });

    return this.initPromise;
  }

  /**
   * Calculates cosine similarity between two vectors.
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Embeds two statements and calculates their semantic similarity (0.0 to 1.0).
   */
  public static async calculateSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const extractor = await this.getInstance();
      
      const outputs = await extractor([text1, text2], { pooling: 'mean', normalize: true });
      
      // outputs.tolist() returns an array of nested arrays for the batches
      // Shape is typically [batch_size, sequence_length, hidden_dimension]
      // With pooling: 'mean', it's [batch_size, hidden_dimension]
      const embeddings = outputs.tolist();
      
      const vec1 = embeddings[0];
      const vec2 = embeddings[1];

      return this.cosineSimilarity(vec1, vec2);
    } catch (error) {
      console.warn('[SemanticEvaluator] Failed to calculate similarity:', error);
      return 0; // Fallback to 0 if model fails to load or calculate
    }
  }
}
