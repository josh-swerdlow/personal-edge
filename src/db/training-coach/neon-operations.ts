// Neon PostgreSQL operations for Training Coach
// Uses backend API to keep credentials secure

import { Deck } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function getAllDecksFromNeon(): Promise<Deck[]> {
  return await apiRequest<Deck[]>('/api/decks');
}

export async function getDeckFromNeon(id: string): Promise<Deck | null> {
  try {
    return await apiRequest<Deck>(`/api/decks/${id}`);
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function createDeckInNeon(deck: Omit<Deck, 'createdAt' | 'updatedAt'>): Promise<Deck> {
  return await apiRequest<Deck>('/api/decks', {
    method: 'POST',
    body: JSON.stringify(deck),
  });
}

export async function updateDeckInNeon(
  id: string,
  updates: Partial<Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Deck> {
  return await apiRequest<Deck>(`/api/decks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteDeckInNeon(id: string): Promise<void> {
  await apiRequest(`/api/decks/${id}`, {
    method: 'DELETE',
  });
}

