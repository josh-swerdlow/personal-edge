import Dexie, { Table } from 'dexie';
import { Deck } from './types';

export class TrainingCoachDB extends Dexie {
  decks!: Table<Deck, string>;

  constructor() {
    super("TrainingCoachDB");
    this.version(2).stores({
      decks: "id, name, updatedAt, discipline"
    });
  }
}

export const trainingCoachDB = new TrainingCoachDB();
