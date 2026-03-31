import type { DescriptorEvaluationResult, DifficultyBand } from "./groqEvaluator";

const BAND_ORDER: DifficultyBand[] = ["A1", "A2", "B1", "B2", "C1"];

function bandIndex(band: DifficultyBand): number {
  return BAND_ORDER.indexOf(band);
}

export function decideNextBand(
  currentBand: DifficultyBand,
  result: DescriptorEvaluationResult,
  recentStrongResults: number
): DifficultyBand {
  const currentIdx = bandIndex(currentBand);
  const matchedIdx = bandIndex(result.matchedBand);

  // If low confidence, don't move
  if (result.confidence < 0.55) return currentBand;

  // --- FAST TRACK PROMOTION ---
  // If the AI matches a band strictly higher than current AND confidence is excellent,
  // we jump immediately without waiting for the 2-result stability window.
  const isHighConfidence = result.confidence > 0.85;
  const isSignificantlyHigher = matchedIdx > currentIdx + 1;

  if (matchedIdx > currentIdx) {
    if (isHighConfidence && matchedIdx > currentIdx + 1) {
      // DOUBLE JUMP
      return BAND_ORDER[Math.min(currentIdx + 2, BAND_ORDER.length - 1)];
    }
    if (isHighConfidence || isSignificantlyHigher || recentStrongResults >= 2) {
      return BAND_ORDER[currentIdx + 1];
    }
  }

  // --- DEMOTION ---
  // We are more conservative with demotion but still responsive
  if (
    matchedIdx < currentIdx &&
    result.difficultyAction === "decrease" &&
    currentIdx > 0
  ) {
    return BAND_ORDER[currentIdx - 1];
  }

  return currentBand;
}
