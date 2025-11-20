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
