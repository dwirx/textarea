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
import { ListFilter, ImagePlus, HelpCircle } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NotesPanel } from './NotesPanel';
import { HelpPanel } from './HelpPanel';
import { Note, loadNotes, saveNotes, createNote, getNoteTitleFromContent } from '@/lib/notes';

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
  const [showHelp, setShowHelp] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

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
        placeholder: 'Start typing... (Press ? for help)',
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
          onSelectNote={setActiveNoteId}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Help panel */}
      {showHelp && (
        <HelpPanel onClose={() => setShowHelp(false)} />
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
        <article className="w-full px-4 sm:px-6 pt-6 sm:pt-8 pb-24">
          <EditorContent editor={editor} />
        </article>
      </main>

      {/* Bottom buttons */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
        <button
          onClick={() => setShowHelp(true)}
          className="p-2 text-neutral-600 hover:text-neutral-300 transition-colors duration-200"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setShowPanel(true)}
          className="p-2 text-neutral-600 hover:text-neutral-300 transition-colors duration-200"
          aria-label="Open notes"
        >
          <ListFilter className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
