import { trainingCoachDB } from './db';
import { Deck, Card, Section } from './types';
import {
  createDeckInNeon,
  updateDeckInNeon,
  deleteDeckInNeon
} from './neon-operations';
import { syncDeckFromNeon } from '../sync/syncFromNeon';
import { NetworkError, withRetry } from '../../utils/errorHandler';

// Simple UUID v4 generator for browser
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to check if Neon is available (via API)
function isNeonAvailable(): boolean {
  return !!import.meta.env.VITE_API_URL;
}

// Helper to write to Neon and sync back to IndexedDB
async function writeToNeonAndSync(
  writeFn: () => Promise<Deck>,
  deckId: string
): Promise<Deck> {
  if (!isNeonAvailable()) {
    // If Neon is not configured, just use IndexedDB (for local dev)
    return await writeFn();
  }

  try {
    // Write to Neon first (source of truth)
    const deck = await withRetry(writeFn, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Sync the deck back from Neon to IndexedDB
    await syncDeckFromNeon(deckId);

    return deck;
  } catch (error: any) {
    // If Neon write fails, throw a NetworkError for user-friendly handling
    if (isNetworkError(error)) {
      throw new NetworkError(
        'Failed to save changes. Please check your internet connection and try again.',
        error
      );
    }
    throw error;
  }
}

function isNetworkError(error: any): boolean {
  return error?.code === 'ECONNREFUSED' ||
         error?.code === 'ETIMEDOUT' ||
         error?.message?.includes('network') ||
         error?.message?.includes('fetch') ||
         error?.message?.includes('connection');
}

// Deck Operations
export async function createDeck(deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'sections'>): Promise<Deck> {
  const now = Date.now();
  const { createDefaultSections } = await import('../../utils/sections');
  const { getRandomAnimal } = await import('../../utils/deckIcons');
  const deckId = generateUUID();
  const newDeck: Deck = {
    id: deckId,
    ...deck,
    animal: deck.animal || getRandomAnimal(), // Assign random animal if not provided
    sections: createDefaultSections(),
    createdAt: now,
    updatedAt: now,
  };

  return await writeToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await createDeckInNeon(newDeck);
      } else {
        await trainingCoachDB.decks.add(newDeck);
        return newDeck;
      }
    },
    deckId
  );
}

export async function updateDeck(id: string, updates: Partial<Omit<Deck, 'id' | 'createdAt'>>): Promise<Deck> {
  const deck = await trainingCoachDB.decks.get(id);
  if (!deck) throw new Error(`Deck ${id} not found`);

  const updated: Deck = {
    ...deck,
    ...updates,
    updatedAt: Date.now(),
  };

  return await writeToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await updateDeckInNeon(id, updates);
      } else {
        await trainingCoachDB.decks.update(id, updated);
        return updated;
      }
    },
    id
  );
}

export async function deleteDeck(id: string): Promise<void> {
  if (isNeonAvailable()) {
    try {
      await withRetry(
        async () => {
          await deleteDeckInNeon(id);
        },
        { maxRetries: 3, retryDelay: 1000 }
      );
      // Sync: remove from IndexedDB after successful Neon delete
      await trainingCoachDB.decks.delete(id);
    } catch (error: any) {
      if (isNetworkError(error)) {
        throw new NetworkError(
          'Failed to delete deck. Please check your internet connection and try again.',
          error
        );
      }
      throw error;
    }
  } else {
    await trainingCoachDB.decks.delete(id);
  }
}

export async function getAllDecks(): Promise<Deck[]> {
  return await trainingCoachDB.decks.toArray();
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return await trainingCoachDB.decks.get(id);
}

export async function getDeckWithSections(id: string): Promise<Deck | undefined> {
  console.log('[getDeckWithSections] Fetching deck:', id);
  const deck = await trainingCoachDB.decks.get(id);
  if (!deck) {
    console.log('[getDeckWithSections] Deck not found:', id);
    return undefined;
  }

  console.log('[getDeckWithSections] Deck found:', {
    id: deck.id,
    name: deck.name,
    hasSections: !!deck.sections,
    sectionsCount: deck.sections?.length || 0,
    sections: deck.sections
  });

  // Ensure deck has sections (migrate old decks)
  if (!deck.sections || deck.sections.length === 0) {
    console.log('[getDeckWithSections] Deck missing sections, creating default sections');
    const { createDefaultSections } = await import('../../utils/sections');
    const updatedDeck = {
      ...deck,
      sections: createDefaultSections(),
      updatedAt: Date.now(),
    };
    await trainingCoachDB.decks.update(id, updatedDeck);
    console.log('[getDeckWithSections] Deck migrated with default sections');
    return updatedDeck;
  }

  // Ensure all sections have cards array (migrate old sections with contentList)
  let needsMigration = false;
  interface LegacySection extends Section {
    contentList?: Array<{
      id: string;
      content: string;
      tags?: string[];
      helpfulnessScore?: number;
      priority?: boolean;
      markedForMerge?: boolean;
      createdAt?: number;
      lastUpvotedAt?: number;
    }>;
  }
  const migratedSections = deck.sections.map((section) => {
    const legacySection = section as LegacySection;
    const hasContentList = !!legacySection.contentList;
    const hasCards = !!section.cards;

    if (hasContentList && !hasCards) {
      console.log(`[getDeckWithSections] Migrating section "${section.title}" from contentList to cards`);
      needsMigration = true;
      // Migrate from old contentList to cards
      const oldContent = legacySection.contentList || [];
      return {
        ...section,
        cards: oldContent.map((content) => ({
          id: content.id,
          sectionId: section.id,
          content: content.content,
          tags: content.tags,
          helpfulnessScore: content.helpfulnessScore || 0,
          priority: content.priority || false,
          markedForMerge: content.markedForMerge || false,
          createdAt: content.createdAt || Date.now(),
          lastUpvotedAt: content.lastUpvotedAt,
        })),
      };
    }

    if (!hasCards) {
      console.log(`[getDeckWithSections] Section "${section.title}" missing cards array, initializing empty`);
      needsMigration = true;
      return {
        ...section,
        cards: [],
      };
    }

    // Unpack content if it's stored as JSON with a 'text' or 'content' property
    let sectionNeedsMigration = false;
    const cardsWithUnpackedContent = section.cards?.map(card => {
      let cardContent = card.content;

      // Handle JSON string format: '{"text": "content"}'
      if (typeof cardContent === 'string' && cardContent.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(cardContent);
          if (typeof parsed === 'object' && parsed !== null) {
            if ('text' in parsed) {
              cardContent = parsed.text;
              sectionNeedsMigration = true;
            } else if ('content' in parsed) {
              cardContent = parsed.content;
              sectionNeedsMigration = true;
            }
          }
        } catch (e) {
          // Not valid JSON, keep as is
        }
      }

      // Handle object format: {text: "content"}
      if (typeof cardContent === 'object' && cardContent !== null) {
        if ('text' in cardContent) {
          cardContent = (cardContent as any).text;
          sectionNeedsMigration = true;
        } else if ('content' in cardContent) {
          cardContent = (cardContent as any).content;
          sectionNeedsMigration = true;
        } else {
          // Fallback: stringify if it's an object
          cardContent = JSON.stringify(cardContent);
          sectionNeedsMigration = true;
        }
      }

      return {
        ...card,
        content: cardContent,
      };
    });

    if (sectionNeedsMigration) {
      needsMigration = true;
      return {
        ...section,
        cards: cardsWithUnpackedContent,
      };
    }

    return section;
  });

  // Update if migration was needed
  if (needsMigration) {
    console.log('[getDeckWithSections] Updating deck with migrated sections');
    const updatedDeck = {
      ...deck,
      sections: migratedSections,
      updatedAt: Date.now(),
    };
    await trainingCoachDB.decks.update(id, updatedDeck);
    return updatedDeck;
  }

  console.log('[getDeckWithSections] Deck is up to date, returning as-is');
  return deck;
}

// Section Operations
export async function addSectionToDeck(
  deckId: string,
  section: Omit<Section, 'id'>
): Promise<Section> {
  const deck = await trainingCoachDB.decks.get(deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);

  const newSection: Section = {
    id: generateUUID(),
    ...section,
  };

  const updatedSections = [...(deck.sections || []), newSection];

  await updateDeck(deckId, {
    sections: updatedSections,
  });

  return newSection;
}

export async function updateDeckSections(
  deckId: string,
  sections: Section[]
): Promise<Deck> {
  return await updateDeck(deckId, { sections });
}

// Card Operations (Cards are now notes within sections)
export async function addCardToSection(
  deckId: string,
  sectionId: string,
  card: Omit<Card, 'id' | 'createdAt' | 'sectionId'> & { createdAt?: number }
): Promise<Card> {
  const deck = await trainingCoachDB.decks.get(deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);

  const newCard: Card = {
    id: generateUUID(),
    sectionId,
    ...card,
    createdAt: card.createdAt ?? Date.now(), // Use provided date or default to now
  };

  const updatedSections = (deck.sections || []).map(section => {
    if (section.id === sectionId) {
      const cards = section.cards || [];
      console.log('[addCardToSection] Adding card to section:', {
        sectionId,
        sectionTitle: section.title,
        currentCardsCount: cards.length,
        newCardId: newCard.id
      });
      return { ...section, cards: [...cards, newCard] };
    }
    return section;
  });

  await updateDeck(deckId, {
    sections: updatedSections,
  });

  return newCard;
}

export async function updateCard(
  deckId: string,
  sectionId: string,
  cardId: string,
  updates: Partial<Omit<Card, 'id' | 'createdAt' | 'sectionId'>>
): Promise<Card> {
  const deck = await trainingCoachDB.decks.get(deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);

  const updatedSections = (deck.sections || []).map(section => {
    if (section.id === sectionId) {
      const cards = section.cards || [];
      console.log('[updateCard] Updating card in section:', {
        sectionId,
        sectionTitle: section.title,
        cardId,
        cardsCount: cards.length
      });

      // Automatically clear priority if card is in Troubleshooting or Theory
      const finalUpdates = { ...updates };
      if (section.title === 'Troubleshooting' || section.title === 'Theory') {
        finalUpdates.priority = false;
      }

      return {
        ...section,
        cards: cards.map(card =>
          card.id === cardId ? { ...card, ...finalUpdates } : card
        ),
      };
    }
    return section;
  });

  await updateDeck(deckId, {
    sections: updatedSections,
  });

  const section = updatedSections.find(s => s.id === sectionId);
  if (!section) throw new Error(`Section ${sectionId} not found`);

  const cards = section.cards || [];
  const updatedCard = cards.find(c => c.id === cardId);

  if (!updatedCard) throw new Error(`Card ${cardId} not found`);

  console.log('[updateCard] Card updated successfully:', {
    cardId,
    sectionId,
    sectionTitle: section.title
  });

  return updatedCard;
}

export async function deleteCard(
  deckId: string,
  sectionId: string,
  cardId: string
): Promise<void> {
  const deck = await trainingCoachDB.decks.get(deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);

  const updatedSections = (deck.sections || []).map(section => {
    if (section.id === sectionId) {
      const cards = section.cards || [];
      console.log('[deleteCard] Deleting card from section:', {
        sectionId,
        sectionTitle: section.title,
        cardId,
        cardsCount: cards.length
      });
      return {
        ...section,
        cards: cards.filter(card => card.id !== cardId),
      };
    }
    return section;
  });

  await updateDeck(deckId, {
    sections: updatedSections,
  });
}

export async function moveCard(
  deckId: string,
  fromSectionId: string,
  toSectionId: string,
  cardId: string
): Promise<void> {
  const deck = await trainingCoachDB.decks.get(deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);

  const fromSection = deck.sections?.find(s => s.id === fromSectionId);
  if (!fromSection) throw new Error(`Section ${fromSectionId} not found`);

  const cards = fromSection.cards || [];
  const card = cards.find(c => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not found`);

  console.log('[moveCard] Moving card:', {
    cardId,
    fromSectionId,
    toSectionId,
    fromSectionTitle: fromSection.title
  });

  const updatedSections = (deck.sections || []).map(section => {
    if (section.id === fromSectionId) {
      const sectionCards = section.cards || [];
      return {
        ...section,
        cards: sectionCards.filter(c => c.id !== cardId),
      };
    }
    if (section.id === toSectionId) {
      const sectionCards = section.cards || [];
      return {
        ...section,
        cards: [...sectionCards, { ...card, sectionId: toSectionId }],
      };
    }
    return section;
  });

  await updateDeck(deckId, {
    sections: updatedSections,
  });
}

// Helper to get all cards from all decks (for search/prioritization)
export async function getAllCards(): Promise<Array<Card & { deckId: string; sectionTitle?: string }>> {
  const allDecks = await trainingCoachDB.decks.toArray();
  const allCards: Array<Card & { deckId: string; sectionTitle?: string }> = [];

  console.log('[getAllCards] Processing decks:', allDecks.length);

  for (const deck of allDecks) {
    const sections = deck.sections || [];
    console.log(`[getAllCards] Deck "${deck.name}" has ${sections.length} sections`);

    for (const section of sections) {
      // Skip Core Reminders section - it contains duplicates of cards from other sections
      if (section.title === 'Core Reminders') {
        console.log(`[getAllCards] Skipping Core Reminders section (contains duplicates)`);
        continue;
      }

      const cards = section.cards || [];
      console.log(`[getAllCards] Section "${section.title}" has ${cards.length} cards`);

      for (const card of cards) {
        // Unpack content if it's stored as JSON with a 'text' property
        let cardContent = card.content;

        // Handle JSON string format: '{"text": "content"}'
        if (typeof cardContent === 'string' && cardContent.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(cardContent);
            if (typeof parsed === 'object' && parsed !== null) {
              if ('text' in parsed) {
                cardContent = parsed.text;
              } else if ('content' in parsed) {
                cardContent = parsed.content;
              }
            }
          } catch (e) {
            // Not valid JSON, keep as is
          }
        }

        // Handle object format: {text: "content"}
        if (typeof cardContent === 'object' && cardContent !== null) {
          if ('text' in cardContent) {
            cardContent = (cardContent as any).text;
          } else if ('content' in cardContent) {
            cardContent = (cardContent as any).content;
          } else {
            // Fallback: stringify if it's an object
            cardContent = JSON.stringify(cardContent);
          }
        }

        allCards.push({
          ...card,
          content: cardContent,
          deckId: deck.id,
          sectionTitle: section.title,
        });
      }
    }
  }

  console.log('[getAllCards] Total cards found:', allCards.length);
  return allCards;
}

// Migration: Assign animals to existing decks that don't have one
export async function migrateDeckAnimals(): Promise<void> {
  const { getRandomAnimal } = await import('../../utils/deckIcons');
  const decks = await trainingCoachDB.decks.toArray();
  let migrated = 0;

  for (const deck of decks) {
    if (!deck.animal) {
      await updateDeck(deck.id, { animal: getRandomAnimal() });
      migrated++;
    }
  }

  console.log(`[migrateDeckAnimals] Migrated ${migrated} deck(s) with animal assignments`);
}

