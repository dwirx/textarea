import { Note, getNoteTitleFromContent } from '@/lib/notes';
import { X, User } from 'lucide-react';
import { useState, useMemo } from 'react';

interface NotesPanelProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
}

function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function NotesPanel({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onClose,
}: NotesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return notes.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    
    const query = searchQuery.toLowerCase();
    return notes
      .filter(note => {
        const title = getNoteTitleFromContent(note.content).toLowerCase();
        const content = note.content.replace(/<[^>]*>/g, '').toLowerCase();
        return title.includes(query) || content.includes(query);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button - top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" strokeWidth={1.5} />
      </button>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 sm:px-12 pt-12 pb-24">
        {/* Search bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-3 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
            autoFocus
          />
        </div>

        {/* Notes list */}
        <div className="space-y-6">
          {filteredNotes.map((note) => {
            const title = getNoteTitleFromContent(note.content);
            
            return (
              <div
                key={note.id}
                className="group relative"
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => {
                      onSelectNote(note.id);
                      onClose();
                    }}
                    className="text-left"
                  >
                    <span className="text-sm font-mono text-neutral-200 underline underline-offset-2 hover:text-neutral-400 transition-colors">
                      {title}
                    </span>
                  </button>
                  
                  <span className="text-xs font-mono text-neutral-600 whitespace-nowrap underline underline-offset-2">
                    {formatFullDate(note.updatedAt)}
                  </span>
                </div>

                {/* Delete button on hover */}
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="absolute -right-8 top-0 p-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all"
                  aria-label="Delete note"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Create note button */}
        <div className="mt-6">
          <button
            onClick={() => {
              onCreateNote();
              onClose();
            }}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-sm font-mono text-neutral-200 transition-colors"
          >
            Create note
          </button>
        </div>

        {/* Attribution */}
        <div className="mt-6">
          <span className="text-xs font-mono text-neutral-600">
            Created by{' '}
            <span className="underline underline-offset-2">
              nobody
            </span>
          </span>
        </div>
      </div>

      {/* User avatar - right side */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2">
        <div className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-600">
          <User className="w-5 h-5" strokeWidth={1.5} />
        </div>
      </div>

      {/* Bottom center dot */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <div className="w-2 h-2 rounded-full bg-neutral-700" />
      </div>
    </div>
  );
}
