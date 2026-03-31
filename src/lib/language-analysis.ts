export function safeDivide(a: number, b: number) {
  if (!b || isNaN(b)) return 0;
  return a / b;
}

export function computeLexicalScore(text: string) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];

  const uniqueWords = new Set(words);

  const typeTokenRatio = safeDivide(uniqueWords.size, words.length);

  const advancedWords = words.filter(w =>
    w.length > 7 || 
    ["however", "therefore", "consequently", "significant", "mitigate", "orchestrate"].includes(w)
  );

  const advancedRatio = safeDivide(advancedWords.length, words.length);

  return {
    typeTokenRatio,
    advancedRatio,
    score: (typeTokenRatio * 0.5 + advancedRatio * 0.5)
  };
}

export function computeStructureScore(text: string) {
  const sentences = text.split(/[.!?]/).filter(Boolean);

  const sumLength = sentences.reduce((sum, s) => sum + s.split(" ").length, 0);
  const avgLength = safeDivide(sumLength, sentences.length || 1);

  const connectors = [
    "because", "although", "however", "therefore",
    "while", "whereas", "consequently", "despite"
  ];

  const connectorCount = connectors.filter(c => text.includes(c)).length;

  return {
    avgLength,
    connectorCount,
    score: Math.min(1, safeDivide(avgLength, 20) * 0.5 + safeDivide(connectorCount, 3) * 0.5)
  };
}

export function computeSemanticScore(text: string) {
  const hasReason =
    text.includes("because") ||
    text.includes("as a result") ||
    text.includes("therefore");

  const hasOpinion =
    text.includes("I think") ||
    text.includes("in my opinion");

  const hasTechnical =
    /deployment|architecture|system|model|analysis|optimization/i.test(text);

  let score = 0;

  if (hasReason) score += 0.4;
  if (hasOpinion) score += 0.3;
  if (hasTechnical) score += 0.3;

  return {
    hasReason,
    hasOpinion,
    hasTechnical,
    score
  };
}

export function computeOverallLanguageScore(text: string) {
  const lexical = computeLexicalScore(text);
  const structure = computeStructureScore(text);
  const semantic = computeSemanticScore(text);

  const finalScore =
    lexical.score * 0.4 +
    structure.score * 0.3 +
    semantic.score * 0.3;

  return {
    lexical,
    structure,
    semantic,
    finalScore
  };
}

export function mapScoreToCEFR(score: number) {
  if (score < 0.3) return "A1";
  if (score < 0.5) return "A2";
  if (score < 0.7) return "B1";
  if (score < 0.85) return "B2";
  return "C1";
}

export function computeConfidence(evidenceCount: number) {
  if (evidenceCount === 0) return 0.1;
  if (evidenceCount < 3) return 0.4;
  if (evidenceCount < 5) return 0.6;
  return 0.8;
}
