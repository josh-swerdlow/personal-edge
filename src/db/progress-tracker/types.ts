// Progress Tracker Data Types

export type GoalTrack = "on-ice" | "off-ice";

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
  updatedAt?: number;               // Unix timestamp
  archivedAt?: number;              // Unix timestamp
  weekStartDate?: string;            // ISO date string for the week this goal belongs to
  workingGoalIds?: string[];        // Only set on primary goals to preserve ordering of working goals
  track?: GoalTrack;                // "on-ice" or "off-ice", defaults to "on-ice" for backward compatibility
}

// Goal Container: Logical grouping of 1 primary goal + 0-2 working goals
export interface GoalContainer {
  id: string;                       // Same as primary goal id
  discipline: "Spins" | "Jumps" | "Edges";
  primaryGoalId: string;
  workingGoalIds: string[];         // Max 2 items
  createdAt: number;                // Unix timestamp
  weekStartDate?: string;           // ISO date string for the week this container belongs to
  track?: GoalTrack;                 // Derived from primary goal, "on-ice" or "off-ice"
}

export interface GoalSubmission {
  id: string;
  containerId: string;
  primaryGoalId: string;
  discipline: "Spins" | "Jumps" | "Edges";
  weekStartDate?: string;
  notes: string;
  submittedAt: number;
  updatedAt: number;
}

export interface GoalFeedback {
  id: string;
  goalId: string;
  containerId: string;
  discipline: "Spins" | "Jumps" | "Edges";
  weekStartDate?: string;
  rating?: number;
  feedback?: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  track?: GoalTrack;                // "on-ice" or "off-ice" for filtering
}
