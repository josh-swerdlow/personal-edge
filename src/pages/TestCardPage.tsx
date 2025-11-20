import { Deck } from '../db/training-coach/types';
import DeckCardView from '../components/DeckCardView';
import PageLayout from '../components/PageLayout';

// Mock deck with one card of each type, fully populated with lorem ipsum
const testDeck: Deck = {
  id: 'test-card-deck',
  name: 'Test Card Deck',
  tags: ['test'],
  discipline: 'Jumps',
  animal: 'bee',
  createdAt: Date.now() - 86400000 * 30,
  updatedAt: Date.now(),
  sections: [
    {
      id: 'section-reminders',
      title: 'Reminders',
      cards: [
        {
          id: 'card-reminders-1',
          sectionId: 'section-reminders',
          content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
          tags: ['posture', 'technique', 'form'],
          helpfulnessScore: 5,
          priority: true,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 5,
        },
      ],
    },
    {
      id: 'section-troubleshooting',
      title: 'Troubleshooting',
      cards: [
        {
          id: 'card-troubleshooting-1',
          sectionId: 'section-troubleshooting',
          content: 'Feeling: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\nIssue: Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.\n\nSolution: Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.',
          tags: ['balance', 'correction', 'fix'],
          helpfulnessScore: 8,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 7,
        },
      ],
    },
    {
      id: 'section-theory',
      title: 'Theory',
      cards: [
        {
          id: 'card-theory-1',
          sectionId: 'section-theory',
          content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.',
          tags: ['physics', 'mechanics', 'understanding'],
          helpfulnessScore: 3,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 10,
        },
      ],
    },
  ],
};

export default function TestCardPage() {
  return (
    <PageLayout>
      <div className="w-full relative" style={{
        height: 'calc(100svh - var(--deck-navbar-height) - var(--deck-bottom-margin))',
        marginBottom: '32px',
      }}>
        <DeckCardView
          deck={testDeck}
        />
      </div>
    </PageLayout>
  );
}

