// Neon PostgreSQL operations for Training Coach
// Uses backend API to keep credentials secure

import { Deck } from './types';

// Get API URL - always use relative URLs in production/preview (same domain), absolute for local dev
const getApiUrl = () => {
  // In production or preview builds (Vercel), always use relative URLs (same domain as frontend)
  // This works because both frontend and API are deployed to the same domain
  if (import.meta.env.PROD) {
    return ''; // Empty string = relative URL (works for both production and preview)
  }

  // In local development, use VITE_API_URL or default to localhost
  const envUrl = import.meta.env.VITE_API_URL;
  const url = envUrl || 'http://localhost:3001';
  // Remove trailing slashes to avoid double slashes
  return url.replace(/\/+$/, '');
};

const API_URL = getApiUrl();

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Ensure endpoint starts with / to avoid double slashes
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = API_URL ? `${API_URL}${normalizedEndpoint}` : normalizedEndpoint;
  const response = await fetch(url, {
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

