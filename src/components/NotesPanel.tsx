import { Note, getNoteTitleFromContent } from '@/lib/notes';
import { X, User, ChevronDown, Download, Keyboard, Upload, Sun, Moon } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';

interface NotesPanelProps {
  notes: Note[];
  activeNoteId: string | null;
  selectedFont: string;
  theme: 'dark' | 'light';
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onSelectFont: (font: string) => void;
  onExportMarkdown: () => void;
  onImportMarkdown: (content: string, filename: string) => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

// Convert HTML to Markdown
function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Strikethrough
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');

  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let index = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => {
      index++;
      return `${index}. $1\n`;
    }) + '\n';
  });

  // Task lists
  md = md.replace(/<li[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, '[x] $1\n');
  md = md.replace(/<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, '[ ] $1\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
  });

  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');

  // Paragraphs and line breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br[^>]*\/?>/gi, '\n');

  // Clean up remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');

  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
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
  { id: 'sans', name: 'Minimal (Inter)', family: "'Inter', system-ui, sans-serif" },
  { id: 'serif', name: 'Elegant (Playfair)', family: "'Playfair Display', Georgia, serif" },
  { id: 'mono', name: 'Coding (JetBrains)', family: "'JetBrains Mono', monospace" },
  { id: 'typewriter', name: 'Typewriter (Courier)', family: "'Courier Prime', monospace" },
  { id: 'hand', name: 'Handwriting (Caveat)', family: "'Caveat', cursive" },
];

export function NotesPanel({
  notes,
  activeNoteId,
  selectedFont,
  theme,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSelectFont,
  onExportMarkdown,
  onImportMarkdown,
  onToggleTheme,
  onClose,
}: NotesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    onImportMarkdown(text, file.name);

    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
    onClose();
  };

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
      <div className={`fixed inset-0 z-50 overflow-y-auto backdrop-blur-xl ${theme === 'dark' ? 'bg-black/60 backdrop-brightness-150' : 'bg-white/40 backdrop-brightness-105'}`}>
        <button
          onClick={() => setShowHelp(false)}
          className={`absolute top-4 right-4 p-1.5 transition-colors rounded-full hover:bg-black/5 ${theme === 'dark' ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
            }`}
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
          <h1 className={`text-lg font-mono mb-6 ${theme === 'dark' ? 'text-white' : 'text-neutral-800'}`}>
            Keyboard Shortcuts
          </h1>

          <div className="space-y-6 text-sm font-mono">
            <div>
              <div className={theme === 'dark' ? 'text-neutral-400 mb-2' : 'text-neutral-400 mb-2'}>HEADINGS</div>
              <div className={theme === 'dark' ? 'space-y-1 text-neutral-300' : 'space-y-1 text-neutral-500'}>
                <div><code className={theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}># </code> Heading 1</div>
                <div><code className={theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}>## </code> Heading 2</div>
                <div><code className={theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}>### </code> Heading 3</div>
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
              <div className="text-neutral-500 mb-2">KEYBOARD SHORTCUTS</div>
              <div className="space-y-1 text-neutral-400">
                <div><code className="text-neutral-300">Ctrl/Cmd + B</code> Bold</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + I</code> Italic</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + Z</code> Undo</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + Shift + Z</code> Redo</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + S</code> Save (auto)</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + Shift + E</code> Export .md</div>
                <div><code className="text-neutral-300">Ctrl/Cmd + N</code> New note</div>
                <div><code className="text-neutral-300">Esc</code> Close menu</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 backdrop-blur-3xl transition-colors duration-300 ${theme === 'dark' ? 'bg-black/30 backdrop-brightness-150' : 'bg-white/40 backdrop-brightness-105'}`}>
      {/* Hidden import input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 p-1.5 transition-colors rounded-full hover:bg-black/5 ${theme === 'dark' ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
          }`}
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
            className={`w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-all duration-200 ${theme === 'dark'
              ? 'bg-black/20 border-white/20 text-white placeholder:text-neutral-500 focus:border-white/40 focus:bg-white/5'
              : 'bg-white/40 border-black/5 text-neutral-800 placeholder:text-neutral-400 focus:border-black/10 focus:bg-white/60'
              }`}
            autoFocus
          />
        </div>

        {/* Notes list */}
        <div className="space-y-4 mb-8">
          {filteredNotes.length === 0 ? (
            <div className={`text-sm font-mono py-4 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
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
                      <span className={`text-sm font-mono underline underline-offset-2 transition-colors ${theme === 'dark' ? 'text-white hover:text-neutral-300' : 'text-neutral-700 hover:text-neutral-500'
                        }`}>
                        {title}
                      </span>
                    </button>

                    <span className={`text-xs font-mono whitespace-nowrap underline underline-offset-2 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
                      }`}>
                      {formatFullDate(note.updatedAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className={`absolute -right-6 top-0 p-1 opacity-0 group-hover:opacity-100 transition-all ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'
                      }`}
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
          className={`px-4 py-2 border rounded-xl text-sm font-mono transition-all duration-200 ${theme === 'dark'
            ? 'bg-white/5 hover:bg-white/10 border-white/20 text-white hover:border-white/30'
            : 'bg-black/5 hover:bg-black/10 border-black/5 text-neutral-700 hover:border-black/10'
            }`}
        >
          Create note
        </button>

        {/* Divider */}
        <div className={`border-t my-8 ${theme === 'dark' ? 'border-white/10' : 'border-black/5'}`} />

        {/* Settings */}
        <div className="space-y-4">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-2 text-sm font-mono transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Font selector */}
          <div className="relative">
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className={`flex items-center justify-between w-full max-w-xs px-4 py-2 border rounded-xl text-sm font-mono transition-all duration-200 ${theme === 'dark'
                ? 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30'
                : 'bg-black/5 border-black/5 text-neutral-600 hover:bg-black/10 hover:border-black/10'
                }`}
            >
              <span>Font: {currentFontName}</span>
              <ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-400'}`} />
            </button>

            {showFontMenu && (
              <div className={`absolute top-full left-0 mt-2 w-full max-w-xs border rounded-xl overflow-hidden z-10 backdrop-blur-xl shadow-xl ${theme === 'dark' ? 'bg-black/90 border-white/20' : 'bg-white/80 border-black/5'
                }`}>
                {FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => {
                      onSelectFont(font.id);
                      setShowFontMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm font-mono transition-colors ${selectedFont === font.id
                      ? theme === 'dark' ? 'bg-white/20 text-white' : 'bg-black/5 text-neutral-800'
                      : theme === 'dark' ? 'text-neutral-400 hover:bg-white/10 hover:text-white' : 'text-neutral-500 hover:bg-black/5 hover:text-neutral-800'
                      }`}
                    style={{ fontFamily: font.family }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import Markdown */}
          <button
            onClick={() => importInputRef.current?.click()}
            className={`flex items-center gap-2 text-sm font-mono transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            <Upload className="w-4 h-4" />
            Import Markdown
          </button>

          {/* Export Markdown */}
          <button
            onClick={onExportMarkdown}
            className={`flex items-center gap-2 text-sm font-mono transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            <Download className="w-4 h-4" />
            Export to Markdown
          </button>

          {/* Help link */}
          <button
            onClick={() => setShowHelp(true)}
            className={`flex items-center gap-2 text-sm font-mono transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            <Keyboard className="w-4 h-4" />
            Keyboard shortcuts
          </button>
        </div>

        {/* Attribution */}
        <div className="mt-8">
          <span className={`text-xs font-mono ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Created by <span className="underline underline-offset-2">nobody</span>
          </span>
        </div>
      </div>

      {/* User avatar */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2">
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur-sm ${theme === 'dark' ? 'border-white/20 text-neutral-300 bg-black/20' : 'border-black/5 text-neutral-400 bg-white/40'
          }`}>
          <User className="w-5 h-5" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
