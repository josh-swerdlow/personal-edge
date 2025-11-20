import { getAllCards } from './operations';
import { Card } from './types';
import { getAllDecks } from './operations';
import { similarity } from '../../utils/fuzzyMatch';

export interface SearchFilters {
  discipline?: 'Spins' | 'Jumps' | 'Edges';
  deckId?: string;
  sectionTitle?: string;
  tags?: string[];
  dateRange?: { start: number; end: number };
}

export interface CardWithContext extends Card {
  deckId: string;
  sectionId: string;
  deckName?: string;
  sectionTitle?: string;
}

// Search by mode (recent, helpful, priority)
export async function searchByMode(
  mode: 'recent' | 'helpful' | 'priority',
  filters?: SearchFilters
): Promise<CardWithContext[]> {
  let allCards = await getAllCards();

  // Apply filters
  if (filters?.discipline) {
    const decks = await getAllDecks();
    const filteredDeckIds = decks
      .filter(d => d.discipline === filters.discipline)
      .map(d => d.id);
    allCards = allCards.filter(c => filteredDeckIds.includes(c.deckId));
  }

  if (filters?.deckId) {
    allCards = allCards.filter(c => c.deckId === filters.deckId);
  }

  if (filters?.sectionTitle) {
    allCards = allCards.filter(c => c.sectionTitle === filters.sectionTitle);
  }

  if (filters?.tags && filters.tags.length > 0) {
    allCards = allCards.filter(c =>
      c.tags && filters.tags!.some(tag => c.tags!.includes(tag))
    );
  }

  if (filters?.dateRange) {
    allCards = allCards.filter(c =>
      c.createdAt >= filters.dateRange!.start && c.createdAt <= filters.dateRange!.end
    );
  }

  // Apply mode-specific sorting
  let sorted: CardWithContext[] = [];

  switch (mode) {
    case 'recent':
      sorted = allCards.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'helpful':
      sorted = allCards.sort((a, b) => {
        if (b.helpfulnessScore !== a.helpfulnessScore) {
          return b.helpfulnessScore - a.helpfulnessScore;
        }
        return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
      });
      break;
    case 'priority': {
      const priorityCards = allCards.filter(c => c.priority);
      sorted = priorityCards.sort((a, b) => {
        if (b.helpfulnessScore !== a.helpfulnessScore) {
          return b.helpfulnessScore - a.helpfulnessScore;
        }
        return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
      });
      break;
    }
  }

  // Add deck names
  const decks = await getAllDecks();
  const deckMap = new Map(decks.map(d => [d.id, d.name]));

  return sorted.map(c => ({
    ...c,
    deckName: deckMap.get(c.deckId),
  }));
}

// Text/tag search
export async function searchByText(
  query: string,
  filters?: SearchFilters
): Promise<CardWithContext[]> {
  if (!query.trim()) {
    return searchByMode('recent', filters);
  }

  let allCards = await getAllCards();
  const queryLower = query.toLowerCase();

  // Apply filters first
  if (filters?.discipline) {
    const decks = await getAllDecks();
    const filteredDeckIds = decks
      .filter(d => d.discipline === filters.discipline)
      .map(d => d.id);
    allCards = allCards.filter(c => filteredDeckIds.includes(c.deckId));
  }

  if (filters?.deckId) {
    allCards = allCards.filter(c => c.deckId === filters.deckId);
  }

  if (filters?.sectionTitle) {
    allCards = allCards.filter(c => c.sectionTitle === filters.sectionTitle);
  }

  if (filters?.tags && filters.tags.length > 0) {
    allCards = allCards.filter(c =>
      c.tags && filters.tags!.some(tag => c.tags!.includes(tag))
    );
  }

  if (filters?.dateRange) {
    allCards = allCards.filter(c =>
      c.createdAt >= filters.dateRange!.start && c.createdAt <= filters.dateRange!.end
    );
  }

  // Use fuzzy matching for content text
  // Calculate similarity scores for all cards
  const cardsWithScores = allCards.map(c => {
    // Check for exact matches first (content and tags)
    const exactContentMatch = c.content.toLowerCase().includes(queryLower);
    const exactTagMatch = c.tags?.some(tag => tag.toLowerCase().includes(queryLower));
    const hasExactMatch = exactContentMatch || exactTagMatch;

    // Calculate fuzzy similarity for content text
    const contentSimilarity = similarity(query, c.content);

    // Calculate fuzzy similarity for tags
    const tagSimilarities = c.tags?.map(tag => similarity(query, tag)) || [];
    const maxTagSimilarity = tagSimilarities.length > 0 ? Math.max(...tagSimilarities) : 0;

    // Use the best match (content or tag)
    const bestSimilarity = Math.max(contentSimilarity, maxTagSimilarity);

    // Use fuzzy matching with 60% threshold, or exact matches
    const matches = hasExactMatch || bestSimilarity >= 60;

    return {
      card: c,
      exactMatch: hasExactMatch,
      similarity: bestSimilarity,
      matches,
      exactContentMatch,
      exactTagMatch,
    };
  });

  // Filter to only matching items
  const matching = cardsWithScores.filter(item => item.matches);

  // Sort by relevance:
  // 1. Exact matches first
  // 2. Then by similarity score (highest first)
  // 3. Then by helpfulness score
  const sorted = matching.sort((a, b) => {
    // Exact matches come first
    if (a.exactMatch && !b.exactMatch) return -1;
    if (!a.exactMatch && b.exactMatch) return 1;

    // If both are exact or both are fuzzy, sort by similarity
    if (Math.abs(a.similarity - b.similarity) > 0.1) {
      return b.similarity - a.similarity;
    }

    // Then by helpfulness score
    return b.card.helpfulnessScore - a.card.helpfulnessScore;
  }).map(item => item.card);

  // Add deck names
  const decks = await getAllDecks();
  const deckMap = new Map(decks.map(d => [d.id, d.name]));

  return sorted.map(c => ({
    ...c,
    deckName: deckMap.get(c.deckId),
  }));
}

// Get prioritized cards for dashboard
export async function getPrioritizedCards(
  filters?: { discipline?: string; limit?: number }
): Promise<CardWithContext[]> {
  const allCards = await getAllCards();

  let filtered = allCards;

  if (filters?.discipline) {
    const decks = await getAllDecks();
    const filteredDeckIds = decks
      .filter(d => d.discipline === filters.discipline)
      .map(d => d.id);
    filtered = filtered.filter(c => filteredDeckIds.includes(c.deckId));
  }

  // Filter out Troubleshooting, Theory, and Core Reminders sections (priority only allowed in Reminders)
  filtered = filtered.filter(c => {
    const sectionTitle = c.sectionTitle || '';
    return sectionTitle !== 'Troubleshooting' && sectionTitle !== 'Theory' && sectionTitle !== 'Core Reminders';
  });

  // Sort: Priority first, then helpfulness, then recency
  const sorted = filtered.sort((a, b) => {
    // Priority first
    if (a.priority !== b.priority) {
      return a.priority ? -1 : 1;
    }
    // Then helpfulness
    if (a.helpfulnessScore !== b.helpfulnessScore) {
      return b.helpfulnessScore - a.helpfulnessScore;
    }
    // Then recency
    return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
  });

  const limited = sorted.slice(0, filters?.limit || 20);

  // Add deck names
  const decks = await getAllDecks();
  const deckMap = new Map(decks.map(d => [d.id, d.name]));

  return limited.map(c => ({
    ...c,
    deckName: deckMap.get(c.deckId),
  }));
}

