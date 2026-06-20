const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Learning {
  id: string;
  title: string;
  transcript: string;
  summary: string;
  category: string | null;
  audioUrl: string | null;
  audioDuration: string | null;
  keyConcepts: string | null;
  actionItems: string | null;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  name: string;
  email: string;
}

// Token management helper
export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

export const setAuthToken = (token: string | null) => {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
};

export const getCurrentUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
};

export const setCurrentUser = (user: User | null) => {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }
};

// Generic REST request helper
async function restRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Set auth header if token exists
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Only set application/json content-type if we aren't uploading files
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// REST endpoints
export const registerUser = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const data = await restRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setAuthToken(data.access_token);
  setCurrentUser({ id: data.user_id, name: data.name, email: data.email });
  return data;
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const data = await restRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  setCurrentUser({ id: data.user_id, name: data.name, email: data.email });
  return data;
};

export const uploadAudioFile = async (fileBlob: Blob, filename: string = 'recording.webm', transcript?: string): Promise<Learning> => {
  const formData = new FormData();
  formData.append('file', fileBlob, filename);
  if (transcript) {
    formData.append('transcript', transcript);
  }

  const res = await restRequest<any>('/api/upload-audio', {
    method: 'POST',
    body: formData,
  });

  return {
    id: res.id,
    title: res.title,
    transcript: res.transcript,
    summary: res.summary,
    category: res.category,
    audioUrl: res.audio_url,
    audioDuration: res.audio_duration,
    keyConcepts: res.key_concepts,
    actionItems: res.action_items,
    createdAt: res.created_at,
  };
};

// Generic GraphQL requester
export async function graphqlRequest<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL execution error');
  }

  return result.data as T;
}

// GraphQL Query: fetch me + learnings
export const fetchMeWithLearnings = async (): Promise<{ me: User & { learnings: Learning[] } | null }> => {
  const query = `
    query GetMeWithLearnings {
      me {
        id
        name
        email
        learnings {
          id
          title
          transcript
          summary
          category
          audioUrl
          audioDuration
          keyConcepts
          actionItems
          createdAt
        }
      }
    }
  `;
  return graphqlRequest<{ me: User & { learnings: Learning[] } | null }>(query);
};

// GraphQL Mutation: delete learning
export const deleteLearning = async (learningId: string): Promise<boolean> => {
  const query = `
    mutation DeleteLearning($learningId: String!) {
      deleteLearning(learningId: $learningId)
    }
  `;
  const result = await graphqlRequest<{ deleteLearning: boolean }>(query, { learningId });
  return result.deleteLearning;
};

// Chatbot Interfaces
export interface ChatSource {
  id: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

// GraphQL Queries for Chat
export const fetchConversations = async (): Promise<Conversation[]> => {
  const query = `
    query GetConversations {
      conversations {
        id
        title
        createdAt
        messages {
          id
          conversationId
          role
          content
          sources {
            id
            title
          }
          createdAt
        }
      }
    }
  `;
  const result = await graphqlRequest<{ conversations: Conversation[] }>(query);
  return result.conversations || [];
};

// GraphQL Mutations for Chat
export const createConversation = async (title?: string): Promise<Conversation> => {
  const query = `
    mutation CreateConversation($title: String) {
      createConversation(title: $title) {
        id
        title
        createdAt
        messages {
          id
        }
      }
    }
  `;
  const result = await graphqlRequest<{ createConversation: Conversation }>(query, { title });
  return result.createConversation;
};

export const sendMessage = async (conversationId: string, content: string): Promise<ChatMessage> => {
  const query = `
    mutation SendMessage($conversationId: String!, $content: String!) {
      sendMessage(conversationId: $conversationId, content: $content) {
        id
        conversationId
        role
        content
        sources {
          id
          title
        }
        createdAt
      }
    }
  `;
  const result = await graphqlRequest<{ sendMessage: ChatMessage }>(query, { conversationId, content });
  return result.sendMessage;
};
