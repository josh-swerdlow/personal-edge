// Improved fuzzy matching with multiple algorithms

// Levenshtein distance implementation
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

// Jaro-Winkler similarity (better for short strings and common prefixes)
export function jaroWinkler(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Find transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3.0;

  // Winkler modification (common prefix bonus)
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + (0.1 * prefix * (1 - jaro));
}

// Token-based similarity (better for word order variations)
export function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = str1.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const tokens2 = str2.toLowerCase().split(/\s+/).filter(t => t.length > 0);

  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// Combined similarity score (weighted average of multiple algorithms)
export function combinedSimilarity(str1: string, str2: string): number {
  const levenshteinSim = 1 - (levenshteinDistance(str1, str2) / Math.max(str1.length, str2.length, 1));
  const jaroWinklerSim = jaroWinkler(str1, str2);
  const tokenSim = tokenSimilarity(str1, str2);

  // Weighted combination: Jaro-Winkler is best for short strings, token for word variations
  const weight = str1.length < 20 ? 0.4 : 0.2; // More weight to Jaro-Winkler for short strings
  return (weight * jaroWinklerSim + 0.3 * tokenSim + (1 - weight - 0.3) * levenshteinSim) * 100;
}

// Calculate similarity percentage (0-100) - using improved algorithm
export function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;

  // Use combined similarity for better results
  return combinedSimilarity(str1, str2);
}

// Find similar cards with location info
export interface SimilarCard {
  content: string;
  similarity: number;
  deckId: string;
  sectionId: string;
  cardId: string;
  helpfulnessScore: number;
  deckName?: string;
  cardDate?: number;
  sectionTitle?: string;
}

export function findSimilarCards(
  text: string,
  allCards: Array<{
    content: string;
    deckId: string;
    sectionId: string;
    id: string;
    helpfulnessScore: number;
    deckName?: string;
    createdAt?: number;
    sectionTitle?: string;
  }>,
  threshold: number = 70
): SimilarCard[] {
  const results: SimilarCard[] = [];

  for (const item of allCards) {
    const sim = similarity(text, item.content);
    if (sim >= threshold) {
      results.push({
        content: item.content,
        similarity: sim,
        deckId: item.deckId,
        sectionId: item.sectionId,
        cardId: item.id,
        helpfulnessScore: item.helpfulnessScore,
        deckName: item.deckName,
        cardDate: item.createdAt,
        sectionTitle: item.sectionTitle,
      });
    }
  }

  // Sort by similarity descending, then by helpfulness
  return results.sort((a, b) => {
    if (Math.abs(a.similarity - b.similarity) > 0.1) {
      return b.similarity - a.similarity;
    }
    return b.helpfulnessScore - a.helpfulnessScore;
  }).slice(0, 3); // Return top 3 matches
}

// Legacy alias for backward compatibility during migration
export interface SimilarContent extends SimilarCard {}
export const findSimilarContent = findSimilarCards;
