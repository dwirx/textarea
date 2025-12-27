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

// Get markdown prefix for element type
function getMarkdownPrefix(tagName: string): string {
  switch (tagName) {
    case 'h1': return '# ';
    case 'h2': return '## ';
    case 'h3': return '### ';
    case 'strong':
    case 'b': return '**';
    case 'em':
    case 'i': return '*';
    case 'code': return '`';
    case 'li': return '- ';
    default: return '';
  }
}

function getMarkdownSuffix(tagName: string): string {
  switch (tagName) {
    case 'strong':
    case 'b': return '**';
    case 'em':
    case 'i': return '*';
    case 'code': return '`';
    default: return '';
  }
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
    element: HTMLElement;
    tagName: string;
    originalText: string;
    rect: DOMRect;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
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

  // Handle click on element to show markdown editor
  const handleElementClick = useCallback((e: React.MouseEvent) => {
    if (editingElement) return;
    
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    
    if (['h1', 'h2', 'h3', 'strong', 'em', 'code', 'li', 'b', 'i'].includes(tagName)) {
      e.preventDefault();
      e.stopPropagation();
      
      const text = target.textContent || '';
      const prefix = getMarkdownPrefix(tagName);
      const suffix = getMarkdownSuffix(tagName);
      const markdown = prefix + text + suffix;
      
      const rect = target.getBoundingClientRect();
      
      // Hide original element completely
      target.style.visibility = 'hidden';
      target.style.position = 'relative';
      
      setEditingElement({
        element: target,
        tagName,
        originalText: text,
        rect
      });
      setEditValue(markdown);
      
      setTimeout(() => {
        editInputRef.current?.focus();
        // Place cursor at end
        const len = editInputRef.current?.value.length || 0;
        editInputRef.current?.setSelectionRange(len, len);
      }, 0);
    }
  }, [editingElement]);

  // Apply the edit
  const applyEdit = useCallback(() => {
    if (!editingElement || !editor) return;
    
    const { element } = editingElement;
    let newText = editValue;
    
    // Remove markdown syntax
    newText = newText
      .replace(/^#{1,3}\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^\*|\*$/g, '')
      .replace(/^`|`$/g, '')
      .replace(/^-\s*/, '');
    
    if (element && element.isConnected) {
      element.style.visibility = 'visible';
      element.textContent = newText;
      
      if (activeNoteId) {
        const html = editor.getHTML();
        updateNote(activeNoteId, html);
      }
    }
    
    setEditingElement(null);
    setEditValue('');
  }, [editingElement, editValue, editor, activeNoteId, updateNote]);

  // Handle keyboard in edit
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyEdit();
    } else if (e.key === 'Escape') {
      if (editingElement?.element) {
        editingElement.element.style.visibility = 'visible';
      }
      setEditingElement(null);
      setEditValue('');
    }
  }, [applyEdit, editingElement]);

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

      {/* Inline markdown editor overlay */}
      {editingElement && (
        <div 
          className="fixed z-[100] bg-black"
          style={{
            left: editingElement.rect.left,
            top: editingElement.rect.top,
            minWidth: Math.max(editingElement.rect.width + 100, 300),
            height: editingElement.rect.height + 4,
          }}
        >
          <input
            ref={editInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={applyEdit}
            className="w-full h-full bg-black text-neutral-100 font-mono focus:outline-none border-b border-neutral-700"
            style={{
              fontSize: editingElement.tagName === 'h1' ? '2rem' : 
                       editingElement.tagName === 'h2' ? '1.5rem' : 
                       editingElement.tagName === 'h3' ? '1.25rem' : '1rem',
              fontWeight: ['h1', 'h2', 'h3', 'strong', 'b'].includes(editingElement.tagName) ? 'bold' : 'normal',
              fontStyle: ['em', 'i'].includes(editingElement.tagName) ? 'italic' : 'normal',
              lineHeight: `${editingElement.rect.height}px`,
              paddingLeft: 0,
            }}
          />
        </div>
      )}

      {/* Editor */}
      <main className="flex-1">
        <article 
          className="w-full px-4 sm:px-6 pt-6 sm:pt-8 pb-24"
          style={{ fontFamily: FONTS[selectedFont] }}
          onClick={handleElementClick}
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
