import { Deck } from '../db/training-coach/types';
import StackedCardsStyleGeneric from '../components/test-visualizations/StackedCardsStyleGeneric';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';

// Mock data for testing visualizations
const mockDeck: Deck = {
  id: 'test-deck-1',
  name: 'Backspin',
  tags: ['spin', 'beginner'],
  discipline: 'Spins',
  createdAt: Date.now() - 86400000 * 30,
  updatedAt: Date.now(),
  sections: [
    {
      id: 'section-1',
      title: 'Reminders',
      cards: [
        {
          id: 'card-1',
          sectionId: 'section-1',
          content: 'Keep your head up and look forward',
          tags: ['posture', 'head'],
          helpfulnessScore: 5,
          priority: true,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 5,
        },
        {
          id: 'card-2',
          sectionId: 'section-1',
          content: 'Bend your knees slightly',
          tags: ['posture', 'knees'],
          helpfulnessScore: 3,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 3,
        },
        {
          id: 'card-3',
          sectionId: 'section-1',
          content: 'Pull arms in tight to center',
          tags: ['arms', 'position'],
          helpfulnessScore: 7,
          priority: true,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 2,
        },
        {
          id: 'card-7',
          sectionId: 'section-1',
          content: 'Maintain strong core engagement throughout',
          tags: ['core', 'strength'],
          helpfulnessScore: 4,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 1,
        },
        {
          id: 'card-8',
          sectionId: 'section-1',
          content: 'Focus on smooth entry into the spin',
          tags: ['entry', 'technique'],
          helpfulnessScore: 6,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 6,
        },
        {
          id: 'card-9',
          sectionId: 'section-1',
          content: 'Keep your free leg extended and controlled',
          tags: ['free leg', 'position'],
          helpfulnessScore: 3,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 4,
        },
      ],
    },
    {
      id: 'section-2',
      title: 'Troubleshooting',
      cards: [
        {
          id: 'card-4',
          sectionId: 'section-2',
          content: 'If spinning too fast, check entry speed',
          tags: ['speed', 'entry'],
          helpfulnessScore: 4,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 7,
        },
        {
          id: 'card-5',
          sectionId: 'section-2',
          content: 'Wobbling usually means off-center',
          tags: ['balance', 'center'],
          helpfulnessScore: 6,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 4,
        },
      ],
    },
    {
      id: 'section-3',
      title: 'Theory',
      cards: [
        {
          id: 'card-6',
          sectionId: 'section-3',
          content: 'Conservation of angular momentum',
          tags: ['physics', 'theory'],
          helpfulnessScore: 2,
          priority: false,
          markedForMerge: false,
          createdAt: Date.now() - 86400000 * 10,
        },
      ],
    },
  ],
};

export default function TestPage() {
  const visualizations = [
    {
      name: 'Variant 3: Blue/Purple',
      gradientFrom: 'blue-50',
      gradientTo: 'purple-50',
      borderColor: 'blue-200',
      variantName: 'Variant 3: Blue/Purple'
    },
    {
      name: 'Variant 4: Pink/Peach',
      gradientFrom: 'pink-50',
      gradientTo: 'orange-50',
      borderColor: 'pink-200',
      variantName: 'Variant 4: Pink/Peach'
    },
    {
      name: 'Variant 6: Green/Mint',
      gradientFrom: 'green-50',
      gradientTo: 'teal-50',
      borderColor: 'green-200',
      variantName: 'Variant 6: Green/Mint'
    },
  ];

  return (
    <PageLayout maxWidth="7xl">
      <h1 className="text-4xl font-bold text-white mb-2">Stacked Cards Style Variants</h1>
      <p className="text-white/70 mb-8">
        Compare different CSS styling approaches for the stacked cards visualization
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {visualizations.map(({ name, gradientFrom, gradientTo, borderColor, variantName }) => (
          <LiquidGlassCard key={name}>
            <div className="min-h-[400px] md:min-h-[500px]">
              <StackedCardsStyleGeneric
                deck={mockDeck}
                gradientFrom={gradientFrom}
                gradientTo={gradientTo}
                borderColor={borderColor}
                variantName={variantName}
              />
            </div>
          </LiquidGlassCard>
        ))}
      </div>
    </PageLayout>
  );
}

