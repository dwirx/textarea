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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Convert HTML to Markdown-like syntax for tooltip display
function htmlToMarkdownPreview(html: string): string {
  let md = html;
  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1');
  // Bold
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  // Italic
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
  // Remove other tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  return md.trim();
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
  const [editingElement, setEditingElement] = useState<{ 
    target: HTMLElement; 
    tagName: string;
    markdown: string;
    originalText: string;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const images = items.filter(item => item.type.startsWith('image/'));
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
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (activeNoteId) {
        debouncedUpdateNote(activeNoteId, editor.getHTML());
      }
    },
  }, [activeNoteId]);

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

  // Handle click on elements to edit markdown source
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    // Don't interfere if clicking inside edit input
    if (editingElement) return;
    
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    
    // Check if clicking on heading, strong, em, code, li, p
    if (['h1', 'h2', 'h3', 'strong', 'em', 'code', 'li', 'b', 'i', 'p'].includes(tagName)) {
      e.preventDefault();
      e.stopPropagation();
      
      const outerHTML = target.outerHTML;
      const markdown = htmlToMarkdownPreview(outerHTML);
      
      if (markdown && markdown.length > 0) {
        const rect = target.getBoundingClientRect();
        setEditingElement({ 
          target, 
          tagName, 
          markdown, 
          originalText: target.textContent || '' 
        });
        setEditValue(markdown);
        // Position below the element
        setTooltipPos({ x: rect.left, y: rect.bottom + 8 });
        
        // Focus input after render
        setTimeout(() => editInputRef.current?.focus(), 10);
      }
    }
  }, [editingElement]);

  // Apply edit and update editor content
  const applyEdit = useCallback(() => {
    if (!editingElement || !editor) return;
    
    const { tagName, originalText } = editingElement;
    let newText = editValue;
    
    // Parse markdown back to plain text for content update
    // Remove markdown syntax to get clean text
    newText = newText
      .replace(/^#{1,3}\s*/, '')  // Remove heading markers
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
      .replace(/\*(.*?)\*/g, '$1')  // Remove italic
      .replace(/`(.*?)`/g, '$1')  // Remove code
      .replace(/^-\s*/, '');  // Remove list marker
    
    // Update the target element's text content directly
    if (editingElement.target && editingElement.target.isConnected) {
      editingElement.target.textContent = newText;
      
      // Trigger editor update
      if (activeNoteId) {
        const html = editor.getHTML();
        updateNote(activeNoteId, html);
      }
    }
    
    setEditingElement(null);
    setEditValue('');
  }, [editingElement, editValue, editor, activeNoteId, updateNote]);

  // Handle key events in edit input
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyEdit();
    } else if (e.key === 'Escape') {
      setEditingElement(null);
      setEditValue('');
    }
  }, [applyEdit]);

  // Close edit on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (editingElement && !target.closest('.markdown-edit-popup')) {
      applyEdit();
    }
  }, [editingElement, applyEdit]);

  useEffect(() => {
    if (editingElement) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingElement, handleClickOutside]);

  if (isLoading) {
    return <div className="min-h-svh bg-black" />;
  }

  return (
    <div 
      className="min-h-svh bg-black flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-neutral-500">
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
          onSelectNote={setActiveNoteId}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onSelectFont={handleSelectFont}
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

      {/* Editable markdown popup */}
      {editingElement && (
        <div 
          className="markdown-edit-popup fixed z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ 
            left: Math.min(tooltipPos.x, window.innerWidth - 320), 
            top: tooltipPos.y,
          }}
        >
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-1.5 bg-neutral-800 border-b border-neutral-700 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Markdown</span>
              <span className="text-[10px] text-neutral-600">Enter untuk simpan, Esc untuk batal</span>
            </div>
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-[300px] px-3 py-2 bg-transparent text-emerald-400 font-mono text-sm focus:outline-none"
              placeholder="Edit markdown..."
            />
          </div>
        </div>
      )}

      {/* Editor */}
      <main className="flex-1">
        <article 
          className="w-full px-4 sm:px-6 pt-6 sm:pt-8 pb-24"
          style={{ fontFamily: FONTS[selectedFont] }}
          ref={editorRef}
          onClick={handleEditorClick}
        >
          <EditorContent editor={editor} />
        </article>
      </main>

      {/* Bottom button - Menu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => setShowPanel(true)}
          className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-full text-neutral-400 hover:text-neutral-200 transition-all duration-200"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
