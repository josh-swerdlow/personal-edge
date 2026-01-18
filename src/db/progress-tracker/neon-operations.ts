// Neon PostgreSQL operations for Progress Tracker
// Uses backend API to keep credentials secure

import { Goal, AppData, GoalSubmission, GoalFeedback } from './types';

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

export async function createGoalInNeon(goal: Omit<Goal, 'createdAt' | 'updatedAt'>): Promise<Goal> {
  console.log('[createGoalInNeon] Sending goal to API:', JSON.stringify(goal, null, 2));
  const result = await apiRequest<Goal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  });
  console.log('[createGoalInNeon] API returned:', JSON.stringify(result, null, 2));
  return result;
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

// Goal Submission Operations
export async function getGoalSubmissionFromNeon(id: string): Promise<GoalSubmission | null> {
  try {
    return await apiRequest<GoalSubmission>(`/api/goal-submissions/${id}`);
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function getGoalSubmissionByContainerFromNeon(
  containerId: string,
  weekStartDate?: string
): Promise<GoalSubmission | null> {
  const params = new URLSearchParams({ containerId });
  if (weekStartDate) {
    params.set('weekStartDate', weekStartDate);
  }

  try {
    return await apiRequest<GoalSubmission>(`/api/goal-submissions?${params.toString()}`);
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function createGoalSubmissionInNeon(
  submission: GoalSubmission
): Promise<GoalSubmission> {
  return await apiRequest<GoalSubmission>('/api/goal-submissions', {
    method: 'POST',
    body: JSON.stringify(submission),
  });
}

export async function updateGoalSubmissionInNeon(
  id: string,
  updates: Partial<Omit<GoalSubmission, 'id'>>
): Promise<GoalSubmission> {
  return await apiRequest<GoalSubmission>(`/api/goal-submissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Goal Feedback Operations
export interface GoalFeedbackQueryParams {
  containerId?: string;
  goalId?: string;
  weekStartDate?: string;
  discipline?: "Spins" | "Jumps" | "Edges";
  completed?: boolean;
}

export async function getGoalFeedbackFromNeon(id: string): Promise<GoalFeedback | null> {
  try {
    return await apiRequest<GoalFeedback>(`/api/goal-feedback/${id}`);
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function queryGoalFeedbackFromNeon(params: GoalFeedbackQueryParams = {}): Promise<GoalFeedback[]> {
  const search = new URLSearchParams();
  if (params.containerId) search.set('containerId', params.containerId);
  if (params.goalId) search.set('goalId', params.goalId);
  if (params.weekStartDate) search.set('weekStartDate', params.weekStartDate);
  if (params.discipline) search.set('discipline', params.discipline);
  if (typeof params.completed === 'boolean') search.set('completed', String(params.completed));

  const query = search.toString();
  const endpoint = query ? `/api/goal-feedback?${query}` : '/api/goal-feedback';
  return await apiRequest<GoalFeedback[]>(endpoint);
}

export async function createGoalFeedbackInNeon(feedback: GoalFeedback): Promise<GoalFeedback> {
  return await apiRequest<GoalFeedback>('/api/goal-feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

export async function updateGoalFeedbackInNeon(
  id: string,
  updates: Partial<Omit<GoalFeedback, 'id'>>
): Promise<GoalFeedback> {
  return await apiRequest<GoalFeedback>(`/api/goal-feedback/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
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

