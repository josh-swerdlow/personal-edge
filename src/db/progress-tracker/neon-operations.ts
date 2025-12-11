// Neon PostgreSQL operations for Progress Tracker
// Uses backend API to keep credentials secure

import { Goal, AppData } from './types';

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

// Goals Operations
export async function getAllGoalsFromNeon(): Promise<Goal[]> {
  return await apiRequest<Goal[]>('/api/goals');
}

export async function getGoalFromNeon(id: string): Promise<Goal | null> {
  try {
    return await apiRequest<Goal>(`/api/goals/${id}`);
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function createGoalInNeon(goal: Omit<Goal, 'createdAt'>): Promise<Goal> {
  return await apiRequest<Goal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  });
}

export async function updateGoalInNeon(
  id: string,
  updates: Partial<Omit<Goal, 'id' | 'createdAt'>>
): Promise<Goal> {
  return await apiRequest<Goal>(`/api/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteGoalInNeon(id: string): Promise<void> {
  await apiRequest(`/api/goals/${id}`, {
    method: 'DELETE',
  });
}

// AppData Operations
export async function getAppDataFromNeon(): Promise<AppData | null> {
  try {
    return await apiRequest<AppData>('/api/app-data');
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function updateAppDataInNeon(updates: Partial<Omit<AppData, 'id'>>): Promise<AppData> {
  return await apiRequest<AppData>('/api/app-data', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

