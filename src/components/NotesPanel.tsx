import { Note, getNoteTitleFromContent, formatDate } from '@/lib/notes';
import { Search, X, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';

interface NotesPanelProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="w-8" />
        <div className="text-sm font-medium text-muted-foreground">Notes</div>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/50 text-sm">
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredNotes.map((note) => {
              const title = getNoteTitleFromContent(note.content);
              const isActive = note.id === activeNoteId;
              
              return (
                <div
                  key={note.id}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-muted' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    onSelectNote(note.id);
                    onClose();
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {title}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(note.updatedAt)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                      aria-label="Delete note"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create note button */}
      <div className="px-4 py-4 border-t border-border">
        <button
          onClick={() => {
            onCreateNote();
            onClose();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Create note
        </button>
      </div>
    </div>
  );
}
