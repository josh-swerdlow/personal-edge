// Progress Tracker Data Types

export interface AppData {
  id: string;
  startDate: string;               // ISO date string for 3-week cycle calculation
  cycleLength: number;              // Default: 3
}

export interface Goal {
  id: string;
  discipline: "Spins" | "Jumps" | "Edges";
  type: "primary" | "working";
  content: string;
  containerId?: string;             // For primary goals: containerId === id. For working goals: references primary goal id
  createdAt: number;                // Unix timestamp
  archivedAt?: number;              // Unix timestamp
  weekStartDate?: string;            // ISO date string for the week this goal belongs to
}

export interface GoalRating {
  goalId: string;
  rating: number;                    // 1-10 or similar
  feedback: string;                  // Text feedback
  archivedAt: number;                // When this rating was created (during archive)
}

// Goal Container: Logical grouping of 1 primary goal + 0-2 working goals
export interface GoalContainer {
  id: string;                       // Same as primary goal id
  discipline: "Spins" | "Jumps" | "Edges";
  primaryGoalId: string;
  workingGoalIds: string[];         // Max 2 items
  createdAt: number;                // Unix timestamp
  weekStartDate?: string;           // ISO date string for the week this container belongs to
}
