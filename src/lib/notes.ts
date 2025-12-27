export interface Note {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getNoteTitleFromContent(content: string): string {
  // Remove HTML tags and get first line
  const text = content.replace(/<[^>]*>/g, '').trim();
  const firstLine = text.split('\n')[0]?.trim() || '';
  return firstLine.slice(0, 50) || 'Untitled';
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  
  // Less than 24 hours
  if (diff < 86400000) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  // Different year
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

const STORAGE_KEY = 'textarea-notes';

export function loadNotes(): Note[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load notes:', e);
  }
  return [];
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes:', e);
  }
}

export function createNote(): Note {
  return {
    id: generateId(),
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
