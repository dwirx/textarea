import { Note, getNoteTitleFromContent } from '@/lib/notes';
import { X, User, HelpCircle, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface NotesPanelProps {
  notes: Note[];
  activeNoteId: string | null;
  selectedFont: string;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onSelectFont: (font: string) => void;
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

const FONTS = [
  { id: 'mono', name: 'Monospace', family: "'IBM Plex Mono', monospace" },
  { id: 'serif', name: 'Serif', family: "'Merriweather', Georgia, serif" },
  { id: 'sans', name: 'Sans Serif', family: "'Inter', system-ui, sans-serif" },
];

export function NotesPanel({
  notes,
  activeNoteId,
  selectedFont,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSelectFont,
  onClose,
}: NotesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);

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

  const currentFontName = FONTS.find(f => f.id === selectedFont)?.name || 'Monospace';

  if (showHelp) {
    return (
      <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
        <button
          onClick={() => setShowHelp(false)}
          className="absolute top-4 right-4 p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
          <h1 className="text-lg font-mono text-neutral-200 mb-6">Markdown Shortcuts</h1>
          
          <div className="space-y-6 text-sm font-mono">
            <div>
              <div className="text-neutral-500 mb-2">HEADINGS</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300"># </code> Heading 1</div>
                <div><code className="text-neutral-300">## </code> Heading 2</div>
                <div><code className="text-neutral-300">### </code> Heading 3</div>
              </div>
            </div>

            <div>
              <div className="text-neutral-500 mb-2">FORMATTING</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300">**text**</code> Bold</div>
                <div><code className="text-neutral-300">*text*</code> Italic</div>
                <div><code className="text-neutral-300">~~text~~</code> Strikethrough</div>
                <div><code className="text-neutral-300">`code`</code> Inline code</div>
              </div>
            </div>

            <div>
              <div className="text-neutral-500 mb-2">LISTS</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300">- </code> Bullet list</div>
                <div><code className="text-neutral-300">1. </code> Numbered list</div>
                <div><code className="text-neutral-300">[ ] </code> Task</div>
                <div><code className="text-neutral-300">[x] </code> Completed</div>
              </div>
            </div>

            <div>
              <div className="text-neutral-500 mb-2">BLOCKS</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300">&gt; </code> Quote</div>
                <div><code className="text-neutral-300">```</code> Code block</div>
                <div><code className="text-neutral-300">---</code> Divider</div>
              </div>
            </div>

            <div>
              <div className="text-neutral-500 mb-2">SHORTCUTS</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300">Cmd+B</code> Bold</div>
                <div><code className="text-neutral-300">Cmd+I</code> Italic</div>
                <div><code className="text-neutral-300">Cmd+Z</code> Undo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
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
        <div className="space-y-4 mb-8">
          {filteredNotes.length === 0 ? (
            <div className="text-neutral-600 text-sm font-mono py-4">
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </div>
          ) : (
            filteredNotes.map((note) => {
              const title = getNoteTitleFromContent(note.content);
              
              return (
                <div key={note.id} className="group relative">
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

                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="absolute -right-6 top-0 p-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Create note button */}
        <button
          onClick={() => {
            onCreateNote();
            onClose();
          }}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-sm font-mono text-neutral-200 transition-colors"
        >
          Create note
        </button>

        {/* Divider */}
        <div className="border-t border-neutral-900 my-8" />

        {/* Settings */}
        <div className="space-y-4">
          {/* Font selector */}
          <div className="relative">
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className="flex items-center justify-between w-full max-w-xs px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-sm font-mono text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              <span>Font: {currentFontName}</span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>
            
            {showFontMenu && (
              <div className="absolute top-full left-0 mt-1 w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-md overflow-hidden z-10">
                {FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => {
                      onSelectFont(font.id);
                      setShowFontMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm font-mono transition-colors ${
                      selectedFont === font.id 
                        ? 'bg-neutral-800 text-neutral-200' 
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                    }`}
                    style={{ fontFamily: font.family }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Help link */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 text-sm font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Markdown shortcuts
          </button>
        </div>

        {/* Attribution */}
        <div className="mt-8">
          <span className="text-xs font-mono text-neutral-700">
            Created by <span className="underline underline-offset-2">nobody</span>
          </span>
        </div>
      </div>

      {/* User avatar */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2">
        <div className="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-700">
          <User className="w-5 h-5" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
