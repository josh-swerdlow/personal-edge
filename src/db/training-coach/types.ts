// Training Coach Data Types

export interface Deck {
  id: string;
  name: string;                    // e.g., "Backspin", "Waltz Jump"
  tags?: string[];                 // e.g., ["spin", "beginner"]
  discipline?: "Spins" | "Jumps" | "Edges";  // For cycle filtering
  animal?: "bee" | "duck" | "cow" | "rabbit" | "dolphin" | "squid";  // Animal icon assigned to deck
  createdAt: number;               // Unix timestamp
  updatedAt: number;               // Unix timestamp
  sections: Section[];             // Sections belong directly to deck
}

export interface Section {
  id: string;
  title: string;                    // e.g., "Reminders", "Troubleshooting", "Theory"
  cards: Card[];                     // Cards (notes) belong to section
}

export interface Card {
  id: string;
  sectionId: string;                // FK to section
  content: string;                  // The actual note/cue text
  tags?: string[];
  helpfulnessScore: number;         // Explicit upvote count
  priority: boolean;                // Priority flag (overrides helpfulness)
  markedForMerge: boolean;          // Cleanup workflow tag
  createdAt: number;               // Unix timestamp
  lastUpvotedAt?: number;          // Unix timestamp for "most recent" sorting
}
