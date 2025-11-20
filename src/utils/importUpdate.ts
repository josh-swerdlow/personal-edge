// importUpdate.ts
// Script to import structured JSON updates into IndexedDB
// Transforms structured content/tags format to database format

import { trainingCoachDB } from '../db/training-coach/db';
import { Deck, Section, Card } from '../db/training-coach/types';
import waltzUpdateData from '../../scripts/db-updates/waltz_update_11192025.json';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Transform structured Theory content to readable text
function transformTheoryContent(content: { bodyParts: Array<{ bodyPart: string; portion: string; description: string }> }): string {
  console.log('  [Transform] Theory content - bodyParts count:', content.bodyParts.length);

  const lines = content.bodyParts.map((bp, index) => {
    const line = `${bp.bodyPart} (${bp.portion}): ${bp.description}`;
    console.log(`    [Transform] Body part ${index + 1}: ${bp.bodyPart} - ${bp.portion}`);
    return line;
  });

  const result = lines.join('\n');
  console.log(`  [Transform] Theory content transformed to ${result.length} characters`);
  return result;
}

// Transform structured Troubleshooting content to readable text
function transformTroubleshootingContent(content: {
  feeling?: string;
  issue?: string;
  solution?: string;
  regressions?: string;
}): string {
  console.log('  [Transform] Troubleshooting content');
  const parts: string[] = [];

  if (content.feeling) {
    console.log(`    [Transform] Feeling: ${content.feeling.substring(0, 50)}...`);
    parts.push(`Feeling: ${content.feeling}`);
  }
  if (content.issue) {
    console.log(`    [Transform] Issue: ${content.issue.substring(0, 50)}...`);
    parts.push(`Issue: ${content.issue}`);
  }
  if (content.solution) {
    console.log(`    [Transform] Solution: ${content.solution.substring(0, 50)}...`);
    parts.push(`Solution: ${content.solution}`);
  }
  if (content.regressions) {
    console.log(`    [Transform] Regressions: ${content.regressions.substring(0, 50)}...`);
    parts.push(`Watch for: ${content.regressions}`);
  }

  const result = parts.join('\n\n');
  console.log(`  [Transform] Troubleshooting content transformed to ${result.length} characters`);
  return result;
}

// Transform structured content to readable text based on section type
function transformContent(content: any, sectionTitle: string): string {
  console.log(`  [Transform] Transforming content for section: ${sectionTitle}`);

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
      console.log(`  [Transform] Reminder content: ${content.content.substring(0, 50)}...`);
      return content.content;
    }
    if (content.text) {
      console.log(`  [Transform] Reminder text: ${content.text.substring(0, 50)}...`);
      return content.text;
    }
  }

  // If content is already a string, return it
  if (typeof content === 'string') {
    return content;
  }

  console.warn('  [Transform] Unknown content format, using JSON fallback');
  return JSON.stringify(content);
}

// Transform structured tags to flat string array
function transformTags(tags: any): string[] {
  console.log('  [Transform] Transforming tags object to array');
  const tagArray: string[] = [];

  if (tags.onOffIce) {
    console.log(`    [Transform] Adding tag: ${tags.onOffIce}`);
    tagArray.push(tags.onOffIce);
  }

  if (tags.partOfElement) {
    console.log(`    [Transform] Adding tag: ${tags.partOfElement}`);
    tagArray.push(tags.partOfElement);
  }

  if (tags.bodyPosition) {
    const bp = tags.bodyPosition;
    console.log(`    [Transform] Adding body position tags: ${bp.horizontalPlane}, ${bp.mediaPlane}, ${bp.frontalPlane}`);
    tagArray.push(bp.horizontalPlane);
    tagArray.push(bp.mediaPlane);
    tagArray.push(bp.frontalPlane);
  }

  if (tags.wildcard && Array.isArray(tags.wildcard)) {
    console.log(`    [Transform] Adding ${tags.wildcard.length} wildcard tags:`, tags.wildcard);
    tagArray.push(...tags.wildcard);
  }

  console.log(`  [Transform] Total tags: ${tagArray.length}`, tagArray);
  return tagArray;
}

// Query and log database state
async function verifyDatabase(): Promise<void> {
  console.log('\n📊 [Verify] Querying IndexedDB to verify changes...\n');

  const allDecks = await trainingCoachDB.decks.toArray();
  console.log(`[Verify] Total decks in database: ${allDecks.length}`);

  let totalCardsAcrossAllDecks = 0;
  let totalPriorityCards = 0;
  let totalCardsWithTags = 0;

  for (const deck of allDecks) {
    console.log(`\n[Verify] Deck: "${deck.name}" (${deck.id})`);
    console.log(`  Discipline: ${deck.discipline || 'N/A'}`);
    console.log(`  Animal: ${deck.animal || 'N/A'}`);
    console.log(`  Created: ${new Date(deck.createdAt).toISOString()}`);
    console.log(`  Updated: ${new Date(deck.updatedAt).toISOString()}`);
    console.log(`  Sections: ${deck.sections.length}`);

    let totalCards = 0;
    for (const section of deck.sections) {
      const cardCount = section.cards?.length || 0;
      totalCards += cardCount;
      totalCardsAcrossAllDecks += cardCount;

      console.log(`    Section "${section.title}": ${cardCount} cards`);

      if (cardCount > 0) {
        const priorityCount = section.cards.filter(c => c.priority).length;
        const withTags = section.cards.filter(c => c.tags && c.tags.length > 0).length;
        totalPriorityCards += priorityCount;
        totalCardsWithTags += withTags;

        console.log(`      - Priority cards: ${priorityCount}`);
        console.log(`      - Cards with tags: ${withTags}`);

        // Show first card as example
        const firstCard = section.cards[0];
        console.log(`      - Example card ID: ${firstCard.id}`);
        console.log(`      - Example card content (first 150 chars): ${firstCard.content.substring(0, 150)}...`);
        console.log(`      - Example card tags (${firstCard.tags?.length || 0}):`, firstCard.tags || []);
        console.log(`      - Example card helpfulnessScore: ${firstCard.helpfulnessScore}`);
        console.log(`      - Example card priority: ${firstCard.priority}`);
      }
    }
    console.log(`  Total cards in deck: ${totalCards}`);
  }

  console.log('\n📊 [Verify] Database Summary:');
  console.log(`  Total decks: ${allDecks.length}`);
  console.log(`  Total cards across all decks: ${totalCardsAcrossAllDecks}`);
  console.log(`  Total priority cards: ${totalPriorityCards}`);
  console.log(`  Total cards with tags: ${totalCardsWithTags}`);

  // Verify the Waltz Jump deck specifically
  const waltzDeck = allDecks.find(d => d.name === 'Waltz Jump');
  if (waltzDeck) {
    console.log(`\n✅ [Verify] Waltz Jump deck found!`);
    const waltzCardCount = waltzDeck.sections.reduce((sum, s) => sum + (s.cards?.length || 0), 0);
    console.log(`  Sections: ${waltzDeck.sections.length}`);
    console.log(`  Total cards: ${waltzCardCount}`);
    waltzDeck.sections.forEach(section => {
      console.log(`    - ${section.title}: ${section.cards?.length || 0} cards`);
    });
  } else {
    console.log(`\n⚠️  [Verify] Waltz Jump deck not found in database`);
  }

  console.log('\n✅ [Verify] Database verification complete!');
  console.log('💡 You can also inspect IndexedDB in DevTools: Application > Storage > IndexedDB > TrainingCoachDB > decks\n');
}

export async function importUpdate(): Promise<void> {
  console.log('🚀 [Import] Starting database update import...\n');
  console.log('[Import] Update file loaded');
  const waltzUpdate = waltzUpdateData as { decks: any[] };
  console.log(`[Import] Processing ${waltzUpdate.decks.length} deck(s) from update file\n`);

  const now = Date.now();
  let decksCreated = 0;
  let decksUpdated = 0;
  let totalCardsAdded = 0;

  for (const deckData of waltzUpdate.decks) {
    console.log(`\n📦 [Import] Processing deck: "${deckData.name}"`);
    console.log(`  Discipline: ${deckData.discipline || 'N/A'}`);
    console.log(`  Sections: ${deckData.sections.length}`);

    // Count total cards in update
    const updateCardCount = deckData.sections.reduce((sum: number, s: any) => sum + s.cards.length, 0);
    console.log(`  Cards in update: ${updateCardCount}`);

    // Check if deck exists
    const existingDecks = await trainingCoachDB.decks
      .where('name')
      .equals(deckData.name)
      .toArray();

    console.log(`  [Import] Existing decks found: ${existingDecks.length}`);

    let deck: Deck;

    if (existingDecks.length > 0) {
      // Update existing deck
      console.log(`  [Import] Updating existing deck: ${existingDecks[0].id}`);
      deck = existingDecks[0];
      const sectionMap = new Map(deck.sections.map(s => [s.title, s]));
      console.log(`  [Import] Existing sections: ${Array.from(sectionMap.keys()).join(', ')}`);

      // Transform and update sections
      let cardsAddedInUpdate = 0;
      const updatedSections: Section[] = deckData.sections.map((sectionData: any, sectionIndex: number) => {
        console.log(`\n  [Import] Processing section ${sectionIndex + 1}/${deckData.sections.length}: "${sectionData.title}"`);
        console.log(`    Cards in section: ${sectionData.cards.length}`);

        const existingSection = sectionMap.get(sectionData.title);
        const sectionId = existingSection?.id || generateUUID();

        if (existingSection) {
          console.log(`    [Import] Section exists, ID: ${sectionId}`);
          console.log(`    [Import] Existing cards in section: ${existingSection.cards?.length || 0}`);
        } else {
          console.log(`    [Import] New section, generated ID: ${sectionId}`);
        }

        // Transform cards
        const newCards: Card[] = sectionData.cards.map((cardData: any, cardIndex: number) => {
          console.log(`\n    [Import] Processing card ${cardIndex + 1}/${sectionData.cards.length}`);
          console.log(`      [Import] Card priority: ${cardData.priority || false}`);
          console.log(`      [Import] Card helpfulnessScore: ${cardData.helpfulnessScore || 0}`);

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

          console.log(`      [Import] Card created with ID: ${card.id}`);
          console.log(`      [Import] Content length: ${card.content.length} characters`);
          console.log(`      [Import] Tags count: ${card.tags?.length || 0}`);

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

      console.log(`\n  [Import] Card count: ${beforeCardCount} → ${afterCardCount} (+${cardsAddedInUpdate})`);

      await trainingCoachDB.decks.update(deck.id, {
        sections: updatedSections,
        updatedAt: now,
      });

      decksUpdated++;
      console.log(`  ✅ [Import] Deck updated successfully: "${deckData.name}"`);
    } else {
      // Create new deck
      console.log(`  [Import] Creating new deck`);
      const deckId = generateUUID();
      console.log(`  [Import] Generated deck ID: ${deckId}`);

      const sections: Section[] = deckData.sections.map((sectionData: any, sectionIndex: number) => {
        console.log(`\n  [Import] Processing section ${sectionIndex + 1}/${deckData.sections.length}: "${sectionData.title}"`);
        console.log(`    Cards in section: ${sectionData.cards.length}`);

        const sectionId = generateUUID();
        console.log(`    [Import] Generated section ID: ${sectionId}`);

        const cards: Card[] = sectionData.cards.map((cardData: any, cardIndex: number) => {
          console.log(`\n    [Import] Processing card ${cardIndex + 1}/${sectionData.cards.length}`);
          console.log(`      [Import] Card priority: ${cardData.priority || false}`);
          console.log(`      [Import] Card helpfulnessScore: ${cardData.helpfulnessScore || 0}`);

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

          console.log(`      [Import] Card created with ID: ${card.id}`);
          console.log(`      [Import] Content length: ${card.content.length} characters`);
          console.log(`      [Import] Tags count: ${card.tags?.length || 0}`);

          return card;
        });

        totalCardsAdded += cards.length;
        console.log(`    [Import] Section created with ${cards.length} cards`);

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
      console.log(`  ✅ [Import] Deck created successfully: "${deckData.name}"`);
    }
  }

  console.log('\n📈 [Import] Import Summary:');
  console.log(`  Decks created: ${decksCreated}`);
  console.log(`  Decks updated: ${decksUpdated}`);
  console.log(`  Total cards added: ${totalCardsAdded}`);
  console.log('✅ [Import] Import complete!\n');

  // Verify the database
  await verifyDatabase();
}

