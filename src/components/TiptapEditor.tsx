import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Menu, ImagePlus } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NotesPanel } from './NotesPanel';
import { Note, loadNotes, saveNotes, createNote, getNoteTitleFromContent } from '@/lib/notes';
import { marked } from 'marked';

// Convert markdown to HTML
function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

// Check if text looks like markdown
function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s/m,           // Headings
    /^\s*[-*+]\s/m,         // Unordered lists
    /^\s*\d+\.\s/m,         // Ordered lists
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic
    /`[^`]+`/,              // Inline code
    /```[\s\S]*```/,        // Code blocks
    /^\s*>/m,               // Blockquotes
    /\[.+\]\(.+\)/,         // Links
  ];
  return mdPatterns.some(pattern => pattern.test(text));
}

// Convert HTML to Markdown for export
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
      return `${index}. \n`;
    }) + '\n';
  });
  
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

const FONTS: Record<string, string> = {
  mono: "'IBM Plex Mono', monospace",
  serif: "'Merriweather', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
};

// Compress image
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function TiptapEditor() {
  const [showPanel, setShowPanel] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFont, setSelectedFont] = useState(() => {
    return localStorage.getItem('textarea-font') || 'mono';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('textarea-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const editorRef = useRef<any>(null);

  // Apply theme to HTML element
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    localStorage.setItem('textarea-theme', theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Save font preference
  const handleSelectFont = useCallback((fontId: string) => {
    setSelectedFont(fontId);
    localStorage.setItem('textarea-font', fontId);
  }, []);

  // Load notes on mount
  useEffect(() => {
    const loadedNotes = loadNotes();
    if (loadedNotes.length === 0) {
      const firstNote = createNote();
      setNotes([firstNote]);
      setActiveNoteId(firstNote.id);
      saveNotes([firstNote]);
    } else {
      setNotes(loadedNotes);
      setActiveNoteId(loadedNotes[0].id);
    }
    setIsLoading(false);
  }, []);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const updateNote = useCallback((id: string, content: string) => {
    setNotes(prev => {
      const updated = prev.map(note => 
        note.id === id 
          ? { ...note, content, updatedAt: Date.now() }
          : note
      );
      saveNotes(updated);
      return updated;
    });
  }, []);

  const debouncedUpdateNote = useCallback(
    debounce((id: string, content: string) => updateNote(id, content), 300),
    [updateNote]
  );

  const handleCreateNote = useCallback(() => {
    const newNote = createNote();
    setNotes(prev => {
      const updated = [newNote, ...prev];
      saveNotes(updated);
      return updated;
    });
    setActiveNoteId(newNote.id);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotes(updated);
      
      if (id === activeNoteId) {
        if (updated.length > 0) {
          setActiveNoteId(updated[0].id);
        } else {
          const newNote = createNote();
          const withNew = [newNote];
          saveNotes(withNew);
          setActiveNoteId(newNote.id);
          return withNew;
        }
      }
      
      return updated;
    });
  }, [activeNoteId]);

  // Export to Markdown
  const handleExportMarkdown = useCallback(() => {
    if (!activeNote) return;
    
    const markdown = htmlToMarkdown(activeNote.content);
    const title = getNoteTitleFromContent(activeNote.content) || 'untitled';
    const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeNote]);

  // Import Markdown
  const handleImportMarkdown = useCallback((content: string, filename: string) => {
    const html = markdownToHtml(content);
    const newNote = createNote();
    newNote.content = html;
    
    setNotes(prev => {
      const updated = [newNote, ...prev];
      saveNotes(updated);
      return updated;
    });
    setActiveNoteId(newNote.id);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      // Ctrl/Cmd + Shift + E = Export
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportMarkdown();
        return;
      }
      
      // Ctrl/Cmd + N = New note
      if (isMod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNote();
        return;
      }
      
      // Escape = Close panel
      if (e.key === 'Escape' && showPanel) {
        setShowPanel(false);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportMarkdown, handleCreateNote, showPanel]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: '',
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      CharacterCount,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'editor-image' },
      }),
      Dropcursor.configure({
        color: '#ffffff',
        width: 1,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[calc(100svh-3rem)]',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files.length) {
          const files = Array.from(event.dataTransfer.files);
          const images = files.filter(file => file.type.startsWith('image/'));
          if (images.length > 0) {
            event.preventDefault();
            images.forEach(async (file) => {
              try {
                const base64 = await compressImage(file);
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.insert(coordinates?.pos ?? view.state.selection.anchor, node);
                view.dispatch(transaction);
              } catch (error) {
                console.error('Failed to process image:', error);
              }
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const images = items.filter(item => item.type.startsWith('image/'));
        
        // Handle image paste
        if (images.length > 0) {
          event.preventDefault();
          images.forEach(async (item) => {
            const file = item.getAsFile();
            if (file) {
              try {
                const base64 = await compressImage(file);
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              } catch (error) {
                console.error('Failed to process image:', error);
              }
            }
          });
          return true;
        }
        
        // Handle markdown paste
        const text = event.clipboardData?.getData('text/plain');
        if (text && looksLikeMarkdown(text)) {
          event.preventDefault();
          const html = markdownToHtml(text);
          
          // Use editorRef to insert content
          if (editorRef.current) {
            editorRef.current.commands.insertContent(html);
            return true;
          }
          
          return false;
        }
        
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (activeNoteId) {
        debouncedUpdateNote(activeNoteId, editor.getHTML());
      }
    },
  }, [activeNoteId]);

  // Set editorRef when editor is ready
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Set editor content when active note changes
  useEffect(() => {
    if (editor && activeNote) {
      const currentContent = editor.getHTML();
      if (currentContent !== activeNote.content) {
        editor.commands.setContent(activeNote.content);
      }
    }
  }, [editor, activeNote?.id]);

  // Handle file input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editor) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await compressImage(file);
          editor.chain().focus().setImage({ src: base64 }).run();
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (e.dataTransfer?.types.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragging(false);
    if (!editor) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    const images = files.filter(file => file.type.startsWith('image/'));
    for (const file of images) {
      try {
        const base64 = await compressImage(file);
        editor.chain().focus().setImage({ src: base64 }).run();
      } catch (error) {
        console.error('Failed to process image:', error);
      }
    }
  };

  // Update title
  useEffect(() => {
    if (activeNote) {
      const title = getNoteTitleFromContent(activeNote.content);
      document.title = title || 'Textarea';
    }
  }, [activeNote?.content]);

  if (isLoading) {
    return <div className={`min-h-svh ${theme === 'dark' ? 'bg-black' : 'bg-neutral-50'}`} />;
  }

  return (
    <div 
      className={`min-h-svh flex flex-col relative ${theme === 'dark' ? 'bg-black' : 'bg-neutral-50'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className={`fixed inset-0 z-40 flex items-center justify-center pointer-events-none ${theme === 'dark' ? 'bg-black/95' : 'bg-white/95'}`}>
          <div className={`flex flex-col items-center gap-2 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <ImagePlus className="w-8 h-8" strokeWidth={1.5} />
            <span className="text-sm font-mono">Drop image</span>
          </div>
        </div>
      )}

      {/* Notes panel */}
      {showPanel && (
        <NotesPanel
          notes={notes}
          activeNoteId={activeNoteId}
          selectedFont={selectedFont}
          theme={theme}
          onSelectNote={setActiveNoteId}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onSelectFont={handleSelectFont}
          onExportMarkdown={handleExportMarkdown}
          onImportMarkdown={handleImportMarkdown}
          onToggleTheme={handleToggleTheme}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Editor */}
      <main className="flex-1">
        <article 
          className="w-full px-4 sm:px-6 pt-6 sm:pt-8 pb-24"
          style={{ fontFamily: FONTS[selectedFont] }}
        >
          <EditorContent editor={editor} />
        </article>
      </main>

      {/* Single bottom button - Menu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => setShowPanel(true)}
          className={`p-3 border rounded-full transition-all duration-200 ${
            theme === 'dark' 
              ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-neutral-200' 
              : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-700 shadow-sm'
          }`}
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
