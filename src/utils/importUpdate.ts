// importUpdate.ts
// Script to import structured JSON updates into IndexedDB
// Transforms structured content/tags format to database format

import { trainingCoachDB } from '../db/training-coach/db';
import { Deck, Section, Card } from '../db/training-coach/types';
import waltzUpdateData from '../../scripts/db-updates/waltz_update_11192025.json';
import { logger } from './logger';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Transform structured Theory content to readable text
function transformTheoryContent(content: { bodyParts: Array<{ bodyPart: string; portion: string; description: string }> }): string {
  logger.verbose('  [Transform] Theory content - bodyParts count:', content.bodyParts.length);

  const lines = content.bodyParts.map((bp, index) => {
    const line = `${bp.bodyPart} (${bp.portion}): ${bp.description}`;
    logger.verbose(`    [Transform] Body part ${index + 1}: ${bp.bodyPart} - ${bp.portion}`);
    return line;
  });

  const result = lines.join('\n');
  logger.verbose(`  [Transform] Theory content transformed to ${result.length} characters`);
  return result;
}

// Transform structured Troubleshooting content to readable text
function transformTroubleshootingContent(content: {
  feeling?: string;
  issue?: string;
  solution?: string;
  regressions?: string;
}): string {
  logger.verbose('  [Transform] Troubleshooting content');
  const parts: string[] = [];

  if (content.feeling) {
    logger.verbose(`    [Transform] Feeling: ${content.feeling.substring(0, 50)}...`);
    parts.push(`Feeling: ${content.feeling}`);
  }
  if (content.issue) {
    logger.verbose(`    [Transform] Issue: ${content.issue.substring(0, 50)}...`);
    parts.push(`Issue: ${content.issue}`);
  }
  if (content.solution) {
    logger.verbose(`    [Transform] Solution: ${content.solution.substring(0, 50)}...`);
    parts.push(`Solution: ${content.solution}`);
  }
  if (content.regressions) {
    logger.verbose(`    [Transform] Regressions: ${content.regressions.substring(0, 50)}...`);
    parts.push(`Watch for: ${content.regressions}`);
  }

  const result = parts.join('\n\n');
  logger.verbose(`  [Transform] Troubleshooting content transformed to ${result.length} characters`);
  return result;
}

// Transform structured content to readable text based on section type
function transformContent(content: any, sectionTitle: string): string {
  logger.verbose(`  [Transform] Transforming content for section: ${sectionTitle}`);

  if (sectionTitle === 'Theory' && content.bodyParts) {
    return transformTheoryContent(content);
  }

  if (sectionTitle === 'Troubleshooting') {
    return transformTroubleshootingContent(content);
  }

  if (sectionTitle === 'Reminders') {
    // Handle both content.content and content.text formats
    if (typeof content === 'string') {
      return content;
    }
    if (content.content) {
      logger.verbose(`  [Transform] Reminder content: ${content.content.substring(0, 50)}...`);
      return content.content;
    }
    if (content.text) {
      logger.verbose(`  [Transform] Reminder text: ${content.text.substring(0, 50)}...`);
      return content.text;
    }
  }

  // If content is already a string, return it
  if (typeof content === 'string') {
    return content;
  }

  logger.warn('  [Transform] Unknown content format, using JSON fallback');
  return JSON.stringify(content);
}

// Transform structured tags to flat string array
function transformTags(tags: any): string[] {
  logger.verbose('  [Transform] Transforming tags object to array');
  const tagArray: string[] = [];

  if (tags.onOffIce) {
    logger.verbose(`    [Transform] Adding tag: ${tags.onOffIce}`);
    tagArray.push(tags.onOffIce);
  }

  if (tags.partOfElement) {
    logger.verbose(`    [Transform] Adding tag: ${tags.partOfElement}`);
    tagArray.push(tags.partOfElement);
  }

  if (tags.bodyPosition) {
    const bp = tags.bodyPosition;
    logger.verbose(`    [Transform] Adding body position tags: ${bp.horizontalPlane}, ${bp.mediaPlane}, ${bp.frontalPlane}`);
    tagArray.push(bp.horizontalPlane);
    tagArray.push(bp.mediaPlane);
    tagArray.push(bp.frontalPlane);
  }

  if (tags.wildcard && Array.isArray(tags.wildcard)) {
    logger.verbose(`    [Transform] Adding ${tags.wildcard.length} wildcard tags:`, tags.wildcard);
    tagArray.push(...tags.wildcard);
  }

  logger.verbose(`  [Transform] Total tags: ${tagArray.length}`, tagArray);
  return tagArray;
}

// Query and log database state
async function verifyDatabase(): Promise<void> {
  logger.verbose('\n📊 [Verify] Querying IndexedDB to verify changes...\n');

  const allDecks = await trainingCoachDB.decks.toArray();
  logger.verbose(`[Verify] Total decks in database: ${allDecks.length}`);

  let totalCardsAcrossAllDecks = 0;
  let totalPriorityCards = 0;
  let totalCardsWithTags = 0;

  for (const deck of allDecks) {
    logger.verbose(`\n[Verify] Deck: "${deck.name}" (${deck.id})`);
    logger.verbose(`  Discipline: ${deck.discipline || 'N/A'}`);
    logger.verbose(`  Animal: ${deck.animal || 'N/A'}`);
    logger.verbose(`  Created: ${new Date(deck.createdAt).toISOString()}`);
    logger.verbose(`  Updated: ${new Date(deck.updatedAt).toISOString()}`);
    logger.verbose(`  Sections: ${deck.sections.length}`);

    let totalCards = 0;
    for (const section of deck.sections) {
      const cardCount = section.cards?.length || 0;
      totalCards += cardCount;
      totalCardsAcrossAllDecks += cardCount;

      logger.verbose(`    Section "${section.title}": ${cardCount} cards`);

      if (cardCount > 0) {
        const priorityCount = section.cards.filter(c => c.priority).length;
        const withTags = section.cards.filter(c => c.tags && c.tags.length > 0).length;
        totalPriorityCards += priorityCount;
        totalCardsWithTags += withTags;

        logger.verbose(`      - Priority cards: ${priorityCount}`);
        logger.verbose(`      - Cards with tags: ${withTags}`);

        // Show first card as example
        const firstCard = section.cards[0];
        logger.verbose(`      - Example card ID: ${firstCard.id}`);
        logger.verbose(`      - Example card content (first 150 chars): ${firstCard.content.substring(0, 150)}...`);
        logger.verbose(`      - Example card tags (${firstCard.tags?.length || 0}):`, firstCard.tags || []);
        logger.verbose(`      - Example card helpfulnessScore: ${firstCard.helpfulnessScore}`);
        logger.verbose(`      - Example card priority: ${firstCard.priority}`);
      }
    }
    logger.verbose(`  Total cards in deck: ${totalCards}`);
  }

  logger.info('\n📊 [Verify] Database Summary:');
  logger.info(`  Total decks: ${allDecks.length}`);
  logger.info(`  Total cards across all decks: ${totalCardsAcrossAllDecks}`);
  logger.info(`  Total priority cards: ${totalPriorityCards}`);
  logger.info(`  Total cards with tags: ${totalCardsWithTags}`);

  // Verify the Waltz Jump deck specifically
  const waltzDeck = allDecks.find(d => d.name === 'Waltz Jump');
  if (waltzDeck) {
    logger.info(`\n✅ [Verify] Waltz Jump deck found!`);
    const waltzCardCount = waltzDeck.sections.reduce((sum, s) => sum + (s.cards?.length || 0), 0);
    logger.verbose(`  Sections: ${waltzDeck.sections.length}`);
    logger.verbose(`  Total cards: ${waltzCardCount}`);
    waltzDeck.sections.forEach(section => {
      logger.verbose(`    - ${section.title}: ${section.cards?.length || 0} cards`);
    });
  } else {
    logger.warn(`\n⚠️  [Verify] Waltz Jump deck not found in database`);
  }

  logger.info('\n✅ [Verify] Database verification complete!');
  logger.verbose('💡 You can also inspect IndexedDB in DevTools: Application > Storage > IndexedDB > TrainingCoachDB > decks\n');
}

export async function importUpdate(): Promise<void> {
  logger.info('🚀 [Import] Starting database update import...\n');
  logger.verbose('[Import] Update file loaded');
  const waltzUpdate = waltzUpdateData as { decks: any[] };
  logger.info(`[Import] Processing ${waltzUpdate.decks.length} deck(s) from update file\n`);

  const now = Date.now();
  let decksCreated = 0;
  let decksUpdated = 0;
  let totalCardsAdded = 0;

  for (const deckData of waltzUpdate.decks) {
    logger.info(`\n📦 [Import] Processing deck: "${deckData.name}"`);
    logger.verbose(`  Discipline: ${deckData.discipline || 'N/A'}`);
    logger.verbose(`  Sections: ${deckData.sections.length}`);

    // Count total cards in update
    const updateCardCount = deckData.sections.reduce((sum: number, s: any) => sum + s.cards.length, 0);
    logger.verbose(`  Cards in update: ${updateCardCount}`);

    // Check if deck exists
    const existingDecks = await trainingCoachDB.decks
      .where('name')
      .equals(deckData.name)
      .toArray();

    logger.verbose(`  [Import] Existing decks found: ${existingDecks.length}`);

    let deck: Deck;

    if (existingDecks.length > 0) {
      // Update existing deck
      logger.verbose(`  [Import] Updating existing deck: ${existingDecks[0].id}`);
      deck = existingDecks[0];
      const sectionMap = new Map(deck.sections.map(s => [s.title, s]));
      logger.verbose(`  [Import] Existing sections: ${Array.from(sectionMap.keys()).join(', ')}`);

      // Transform and update sections
      let cardsAddedInUpdate = 0;
      const updatedSections: Section[] = deckData.sections.map((sectionData: any, sectionIndex: number) => {
        logger.verbose(`\n  [Import] Processing section ${sectionIndex + 1}/${deckData.sections.length}: "${sectionData.title}"`);
        logger.verbose(`    Cards in section: ${sectionData.cards.length}`);

        const existingSection = sectionMap.get(sectionData.title);
        const sectionId = existingSection?.id || generateUUID();

        if (existingSection) {
          logger.verbose(`    [Import] Section exists, ID: ${sectionId}`);
          logger.verbose(`    [Import] Existing cards in section: ${existingSection.cards?.length || 0}`);
        } else {
          logger.verbose(`    [Import] New section, generated ID: ${sectionId}`);
        }

        // Transform cards
        const newCards: Card[] = sectionData.cards.map((cardData: any, cardIndex: number) => {
          logger.verbose(`\n    [Import] Processing card ${cardIndex + 1}/${sectionData.cards.length}`);
          logger.verbose(`      [Import] Card priority: ${cardData.priority || false}`);
          logger.verbose(`      [Import] Card helpfulnessScore: ${cardData.helpfulnessScore || 0}`);

          const transformedContent = transformContent(cardData.content, sectionData.title);
          const transformedTags = transformTags(cardData.tags);

          const card: Card = {
            id: generateUUID(),
            sectionId,
            content: transformedContent,
            tags: transformedTags,
            helpfulnessScore: cardData.helpfulnessScore || 0,
            priority: cardData.priority || false,
            markedForMerge: cardData.markedForMerge || false,
            createdAt: now,
          };

          logger.verbose(`      [Import] Card created with ID: ${card.id}`);
          logger.verbose(`      [Import] Content length: ${card.content.length} characters`);
          logger.verbose(`      [Import] Tags count: ${card.tags?.length || 0}`);

          return card;
        });

        cardsAddedInUpdate += newCards.length;
        totalCardsAdded += newCards.length;

        return {
          id: sectionId,
          title: sectionData.title,
          cards: existingSection
            ? [...(existingSection.cards || []), ...newCards]
            : newCards,
        };
      });

      const beforeCardCount = deck.sections.reduce((sum: number, s: Section) => sum + (s.cards?.length || 0), 0);
      const afterCardCount = updatedSections.reduce((sum: number, s: Section) => sum + (s.cards?.length || 0), 0);

      logger.info(`\n  [Import] Card count: ${beforeCardCount} → ${afterCardCount} (+${cardsAddedInUpdate})`);

      await trainingCoachDB.decks.update(deck.id, {
        sections: updatedSections,
        updatedAt: now,
      });

      decksUpdated++;
      logger.info(`  ✅ [Import] Deck updated successfully: "${deckData.name}"`);
    } else {
      // Create new deck
      logger.verbose(`  [Import] Creating new deck`);
      const deckId = generateUUID();
      logger.verbose(`  [Import] Generated deck ID: ${deckId}`);

      const sections: Section[] = deckData.sections.map((sectionData: any, sectionIndex: number) => {
        logger.verbose(`\n  [Import] Processing section ${sectionIndex + 1}/${deckData.sections.length}: "${sectionData.title}"`);
        logger.verbose(`    Cards in section: ${sectionData.cards.length}`);

        const sectionId = generateUUID();
        logger.verbose(`    [Import] Generated section ID: ${sectionId}`);

        const cards: Card[] = sectionData.cards.map((cardData: any, cardIndex: number) => {
          logger.verbose(`\n    [Import] Processing card ${cardIndex + 1}/${sectionData.cards.length}`);
          logger.verbose(`      [Import] Card priority: ${cardData.priority || false}`);
          logger.verbose(`      [Import] Card helpfulnessScore: ${cardData.helpfulnessScore || 0}`);

          const transformedContent = transformContent(cardData.content, sectionData.title);
          const transformedTags = transformTags(cardData.tags);

          const card: Card = {
            id: generateUUID(),
            sectionId,
            content: transformedContent,
            tags: transformedTags,
            helpfulnessScore: cardData.helpfulnessScore || 0,
            priority: cardData.priority || false,
            markedForMerge: cardData.markedForMerge || false,
            createdAt: now,
          };

          logger.verbose(`      [Import] Card created with ID: ${card.id}`);
          logger.verbose(`      [Import] Content length: ${card.content.length} characters`);
          logger.verbose(`      [Import] Tags count: ${card.tags?.length || 0}`);

          return card;
        });

        totalCardsAdded += cards.length;
        logger.verbose(`    [Import] Section created with ${cards.length} cards`);

        return {
          id: sectionId,
          title: sectionData.title,
          cards,
        };
      });

      deck = {
        id: deckId,
        name: deckData.name,
        discipline: deckData.discipline,
        tags: [],
        sections,
        createdAt: now,
        updatedAt: now,
      };

      await trainingCoachDB.decks.add(deck);
      decksCreated++;
      logger.info(`  ✅ [Import] Deck created successfully: "${deckData.name}"`);
    }
  }

  logger.info('\n📈 [Import] Import Summary:');
  logger.info(`  Decks created: ${decksCreated}`);
  logger.info(`  Decks updated: ${decksUpdated}`);
  logger.info(`  Total cards added: ${totalCardsAdded}`);
  logger.info('✅ [Import] Import complete!\n');

  // Verify the database
  await verifyDatabase();
}

