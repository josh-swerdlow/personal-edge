// comprehensive-seed.ts
// Run this script to populate your IndexedDB with comprehensive test data

import { trainingCoachDB } from '../db/training-coach/db';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { Deck } from '../db/training-coach/types';
import { AppData, Goal, GoalRating } from '../db/progress-tracker/types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to create timestamps
function daysAgo(days: number): number {
  return Date.now() - (days * 24 * 60 * 60 * 1000);
}

// Helper to get week start date (Monday of the week)
function getWeekStartDate(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + (daysOffset * 7));
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

export async function seedDatabase() {
  console.log('🌱 Starting comprehensive database seed...');

  // Clear existing data
  await trainingCoachDB.decks.clear();
  await progressTrackerDB.goals.clear();
  await progressTrackerDB.appData.clear();
  await progressTrackerDB.goalRatings.clear();

  const now = Date.now();
  const baseTimestamp = daysAgo(30); // Start 30 days ago

  // ============================================
  // PROGRESS TRACKER DATA
  // ============================================

  // App Data - Start date 3 weeks ago (so we're in the middle of a cycle)
  const appDataStartDate = new Date();
  appDataStartDate.setDate(appDataStartDate.getDate() - 21); // 3 weeks ago

  const appData: AppData = {
    id: 'app-data-1',
    startDate: appDataStartDate.toISOString().split('T')[0],
    cycleLength: 3,
  };
  await progressTrackerDB.appData.add(appData);
  console.log('✓ Added AppData');

  // Calculate current week discipline (assuming we're in week 1 of cycle = Spins)
  const currentWeekStart = getWeekStartDate(0);
  const lastWeekStart = getWeekStartDate(-1);
  const nextWeekStart = getWeekStartDate(1);
  const week2Start = getWeekStartDate(2);
  const week3Start = getWeekStartDate(3);

  // Current Week Goals (Spins - Primary)
  const currentPrimaryGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Spins',
      type: 'primary',
      content: 'Front Spin → Find true rocker position and maintain throughout rotation',
      createdAt: daysAgo(5),
      weekStartDate: currentWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Spins',
      type: 'primary',
      content: 'Back Spin → Stay over backside edge, prevent forward lean',
      createdAt: daysAgo(4),
      weekStartDate: currentWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Spins',
      type: 'primary',
      content: 'Camel Spin → Keep free leg at hip height, maintain extension',
      createdAt: daysAgo(3),
      weekStartDate: currentWeekStart,
    },
  ];

  // Current Week Working Goals (from other disciplines)
  const currentWorkingGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Jumps',
      type: 'working',
      content: 'Waltz Jump → Keep right shoulder back on entry',
      createdAt: daysAgo(6),
      weekStartDate: currentWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Jumps',
      type: 'working',
      content: 'Salchow → Check entry edge quality before takeoff',
      createdAt: daysAgo(5),
      weekStartDate: currentWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Edges',
      type: 'working',
      content: 'Forward Outside 3-Turn → Maintain edge pressure through turn',
      createdAt: daysAgo(4),
      weekStartDate: currentWeekStart,
    },
  ];

  // Last Week Goals (Jumps - Archived)
  const lastWeekPrimaryGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Jumps',
      type: 'primary',
      content: 'Waltz Jump → Hips ahead of entry edge',
      createdAt: daysAgo(12),
      archivedAt: daysAgo(7),
      weekStartDate: lastWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Jumps',
      type: 'primary',
      content: 'Salchow → Check entry edge, maintain knee bend',
      createdAt: daysAgo(11),
      archivedAt: daysAgo(7),
      weekStartDate: lastWeekStart,
    },
  ];

  const lastWeekWorkingGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Spins',
      type: 'working',
      content: 'Back Spin → Keep left shoulder down',
      createdAt: daysAgo(13),
      archivedAt: daysAgo(7),
      weekStartDate: lastWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Edges',
      type: 'working',
      content: 'Crossovers → Engage lower back muscles',
      createdAt: daysAgo(12),
      archivedAt: daysAgo(7),
      weekStartDate: lastWeekStart,
    },
  ];

  // Future Week Goals
  const nextWeekPrimaryGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Edges',
      type: 'primary',
      content: 'Forward Outside 3-Turn → Maintain edge quality through entire turn',
      createdAt: now,
      weekStartDate: nextWeekStart,
    },
    {
      id: generateUUID(),
      discipline: 'Edges',
      type: 'primary',
      content: 'Backward Inside 3-Turn → Control exit edge',
      createdAt: now,
      weekStartDate: nextWeekStart,
    },
  ];

  const week2WorkingGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Spins',
      type: 'working',
      content: 'Front Spin → Focus on entry edge quality',
      createdAt: now,
      weekStartDate: week2Start,
    },
  ];

  const week3WorkingGoals: Goal[] = [
    {
      id: generateUUID(),
      discipline: 'Jumps',
      type: 'working',
      content: 'Waltz Jump → Practice entry edge control',
      createdAt: now,
      weekStartDate: week3Start,
    },
  ];

  // Add all goals
  const allGoals = [
    ...currentPrimaryGoals,
    ...currentWorkingGoals,
    ...lastWeekPrimaryGoals,
    ...lastWeekWorkingGoals,
    ...nextWeekPrimaryGoals,
    ...week2WorkingGoals,
    ...week3WorkingGoals,
  ];

  for (const goal of allGoals) {
    await progressTrackerDB.goals.add(goal);
  }
  console.log(`✓ Added ${allGoals.length} goals`);

  // Goal Ratings for archived goals
  const goalRatings: GoalRating[] = [
    {
      goalId: lastWeekPrimaryGoals[0].id,
      rating: 4,
      feedback: 'Made good progress on hip position. Still need to work on entry edge timing.',
      archivedAt: daysAgo(7),
    },
    {
      goalId: lastWeekPrimaryGoals[1].id,
      rating: 3,
      feedback: 'Entry edge improving but knee bend still inconsistent.',
      archivedAt: daysAgo(7),
    },
    {
      goalId: lastWeekWorkingGoals[0].id,
      rating: 5,
      feedback: 'Excellent focus on shoulder position. This is now automatic.',
      archivedAt: daysAgo(7),
    },
    {
      goalId: lastWeekWorkingGoals[1].id,
      rating: 2,
      feedback: 'Lower back engagement needs more work. Will continue next cycle.',
      archivedAt: daysAgo(7),
    },
  ];

  for (const rating of goalRatings) {
    await progressTrackerDB.goalRatings.add(rating);
  }
  console.log(`✓ Added ${goalRatings.length} goal ratings`);

  // ============================================
  // TRAINING COACH DATA
  // ============================================

  // SPINS DECKS
  const spinsDecks: Deck[] = [
    {
      id: 'deck-backspin',
      name: 'Backspin',
      tags: ['spin', 'beginner', 'foundation'],
      discipline: 'Spins',
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp + (2 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '', // Will be set
              content: 'Lead with right hip',
              tags: ['hip', 'free-side'],
              helpfulnessScore: 8,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp,
              lastUpvotedAt: baseTimestamp + (5 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep left shoulder down',
              tags: ['shoulder', 'front'],
              helpfulnessScore: 12,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (1 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (10 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain axis through shoulders and hips',
              tags: ['axis', 'alignment'],
              helpfulnessScore: 5,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (2 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Right arm in front, left arm to side',
              tags: ['arms', 'upper-body'],
              helpfulnessScore: 3,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (3 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Troubleshooting',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Losing center — overrotating. Remedy: tighten arm path and focus on core engagement.',
              tags: ['core', 'balance', 'arms', 'upper-body'],
              helpfulnessScore: 6,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (4 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Falling forward — not staying over backside edge. Remedy: check entry edge and weight distribution.',
              tags: ['balance', 'edge', 'entry'],
              helpfulnessScore: 9,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (5 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (15 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Slow rotation — not generating enough speed. Remedy: check entry speed and arm position.',
              tags: ['speed', 'rotation', 'entry'],
              helpfulnessScore: 4,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (6 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Theory',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'The backspin is initiated from a back outside edge entry. The key is maintaining the edge quality while transitioning to the spinning position.',
              tags: ['theory', 'entry', 'edge'],
              helpfulnessScore: 2,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (7 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Axis alignment is critical. The spin axis should run through the center of the body from head to toe.',
              tags: ['theory', 'axis', 'alignment'],
              helpfulnessScore: 1,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (8 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Exercises',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Off-ice: Practice arm positions in front of mirror, focusing on maintaining consistent position throughout rotation',
              tags: ['off-ice', 'arms', 'practice'],
              helpfulnessScore: 3,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (9 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-frontspin',
      name: 'Front Spin',
      tags: ['spin', 'intermediate'],
      discipline: 'Spins',
      createdAt: baseTimestamp + (10 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (12 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Find true rocker position on entry',
              tags: ['rocker', 'entry'],
              helpfulnessScore: 15,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (11 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (20 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep free leg extended and controlled',
              tags: ['free-leg', 'extension'],
              helpfulnessScore: 7,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (12 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain entry edge quality',
              tags: ['edge', 'entry'],
              helpfulnessScore: 6,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (13 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Troubleshooting',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Traveling — not finding rocker. Remedy: practice entry edge and rocker position drills.',
              tags: ['traveling', 'rocker', 'entry'],
              helpfulnessScore: 8,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (14 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-camel-spin',
      name: 'Camel Spin',
      tags: ['spin', 'intermediate', 'position'],
      discipline: 'Spins',
      createdAt: baseTimestamp + (15 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (18 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep free leg at hip height',
              tags: ['free-leg', 'position'],
              helpfulnessScore: 10,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (16 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (22 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain extension through entire spin',
              tags: ['extension', 'position'],
              helpfulnessScore: 5,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (17 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
  ];

  // JUMPS DECKS
  const jumpsDecks: Deck[] = [
    {
      id: 'deck-waltz-jump',
      name: 'Waltz Jump',
      tags: ['jump', 'entry', 'beginner'],
      discipline: 'Jumps',
      createdAt: baseTimestamp + (20 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (25 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Hips ahead of entry',
              tags: ['hip', 'entry'],
              helpfulnessScore: 11,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (21 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (28 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep right shoulder back on entry',
              tags: ['shoulder', 'entry', 'back'],
              helpfulnessScore: 9,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (22 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (26 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Check entry edge quality before takeoff',
              tags: ['edge', 'entry', 'takeoff'],
              helpfulnessScore: 7,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (23 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Arms up and together in air',
              tags: ['arms', 'air', 'upper-body'],
              helpfulnessScore: 4,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (24 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Troubleshooting',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Underrotating — not getting enough rotation. Remedy: check entry speed and arm position.',
              tags: ['rotation', 'entry', 'speed'],
              helpfulnessScore: 6,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (25 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Poor landing — not checking properly. Remedy: focus on landing edge and body position.',
              tags: ['landing', 'edge', 'check'],
              helpfulnessScore: 8,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (26 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Theory',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'The waltz jump is a half-rotation jump from a forward outside edge. Entry edge quality determines jump success.',
              tags: ['theory', 'entry', 'edge'],
              helpfulnessScore: 2,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (27 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-salchow',
      name: 'Salchow',
      tags: ['jump', 'intermediate', 'edge'],
      discipline: 'Jumps',
      createdAt: baseTimestamp + (28 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (30 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Check entry edge before takeoff',
              tags: ['edge', 'entry', 'takeoff'],
              helpfulnessScore: 13,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (29 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (35 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain knee bend on entry',
              tags: ['knee', 'entry', 'lower-body'],
              helpfulnessScore: 8,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (30 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Free leg swing generates rotation',
              tags: ['free-leg', 'rotation'],
              helpfulnessScore: 6,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (31 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Troubleshooting',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Weak takeoff — not generating enough power. Remedy: strengthen entry edge and check timing.',
              tags: ['takeoff', 'power', 'edge'],
              helpfulnessScore: 5,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (32 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-toe-loop',
      name: 'Toe Loop',
      tags: ['jump', 'intermediate', 'toe'],
      discipline: 'Jumps',
      createdAt: baseTimestamp + (33 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (35 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Toe pick placement is critical',
              tags: ['toe', 'pick', 'placement'],
              helpfulnessScore: 9,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (34 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain edge quality on entry',
              tags: ['edge', 'entry'],
              helpfulnessScore: 7,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (35 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
  ];

  // EDGES DECKS
  const edgesDecks: Deck[] = [
    {
      id: 'deck-forward-outside-3-turn',
      name: 'Forward Outside 3-Turn',
      tags: ['turns', 'edge', 'beginner'],
      discipline: 'Edges',
      createdAt: baseTimestamp + (36 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (40 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain edge pressure through turn',
              tags: ['edge', 'pressure', 'turn'],
              helpfulnessScore: 14,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (37 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (42 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep free leg extended behind',
              tags: ['free-leg', 'extension', 'back'],
              helpfulnessScore: 8,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (38 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Control exit edge quality',
              tags: ['edge', 'exit'],
              helpfulnessScore: 6,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (39 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Troubleshooting',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Losing edge — not maintaining pressure. Remedy: focus on weight distribution and edge control.',
              tags: ['edge', 'pressure', 'balance'],
              helpfulnessScore: 7,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (40 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        {
          id: generateUUID(),
          title: 'Theory',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'The 3-turn changes edge from outside to inside while maintaining the same direction of travel.',
              tags: ['theory', 'edge', 'turn'],
              helpfulnessScore: 3,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (41 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-backward-inside-3-turn',
      name: 'Backward Inside 3-Turn',
      tags: ['turns', 'edge', 'intermediate'],
      discipline: 'Edges',
      createdAt: baseTimestamp + (42 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (44 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Control exit edge',
              tags: ['edge', 'exit'],
              helpfulnessScore: 10,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (43 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (45 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain body alignment through turn',
              tags: ['alignment', 'body', 'turn'],
              helpfulnessScore: 5,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (44 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
    {
      id: 'deck-crossovers',
      name: 'Crossovers',
      tags: ['edges', 'basic', 'foundation'],
      discipline: 'Edges',
      createdAt: baseTimestamp + (45 * 24 * 60 * 60 * 1000),
      updatedAt: baseTimestamp + (47 * 24 * 60 * 60 * 1000),
      sections: [
        {
          id: generateUUID(),
          title: 'Reminders',
          cards: [
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Engage lower back muscles',
              tags: ['lower-back', 'core', 'lower-body'],
              helpfulnessScore: 12,
              priority: true,
              markedForMerge: false,
              createdAt: baseTimestamp + (46 * 24 * 60 * 60 * 1000),
              lastUpvotedAt: baseTimestamp + (48 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Keep weight over skating leg',
              tags: ['weight', 'balance', 'leg'],
              helpfulnessScore: 7,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (47 * 24 * 60 * 60 * 1000),
            },
            {
              id: generateUUID(),
              sectionId: '',
              content: 'Maintain edge quality throughout',
              tags: ['edge', 'quality'],
              helpfulnessScore: 5,
              priority: false,
              markedForMerge: false,
              createdAt: baseTimestamp + (48 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
    },
  ];

  // Set sectionId for all cards
  const allDecks = [...spinsDecks, ...jumpsDecks, ...edgesDecks];
  for (const deck of allDecks) {
    for (const section of deck.sections) {
      for (const card of section.cards) {
        card.sectionId = section.id;
      }
    }
  }

  // Add some cards marked for merge (for testing merge workflow)
  allDecks[0].sections[0].cards.push({
    id: generateUUID(),
    sectionId: allDecks[0].sections[0].id,
    content: 'Keep left shoulder down and back',
    tags: ['shoulder', 'front', 'back'],
    helpfulnessScore: 4,
    priority: false,
    markedForMerge: true,
    createdAt: baseTimestamp + (50 * 24 * 60 * 60 * 1000),
  });

  allDecks[1].sections[0].cards.push({
    id: generateUUID(),
    sectionId: allDecks[1].sections[0].id,
    content: 'Maintain rocker position throughout',
    tags: ['rocker', 'position'],
    helpfulnessScore: 3,
    priority: false,
    markedForMerge: true,
    createdAt: baseTimestamp + (51 * 24 * 60 * 60 * 1000),
  });

  // Add all decks
  for (const deck of allDecks) {
    await trainingCoachDB.decks.add(deck);
  }
  console.log(`✓ Added ${allDecks.length} decks (${spinsDecks.length} Spins, ${jumpsDecks.length} Jumps, ${edgesDecks.length} Edges)`);

  // Count total cards
  const totalCards = allDecks.reduce((sum, deck) => {
    return sum + deck.sections.reduce((sectionSum, section) => {
      return sectionSum + section.cards.length;
    }, 0);
  }, 0);
  console.log(`✓ Added ${totalCards} total cards across all decks`);

  console.log('✅ Database seed complete!');
  console.log('\nSummary:');
  console.log(`- ${allDecks.length} decks`);
  console.log(`- ${totalCards} cards`);
  console.log(`- ${allGoals.length} goals`);
  console.log(`- ${goalRatings.length} goal ratings`);
  console.log(`- 1 app data entry`);
}

