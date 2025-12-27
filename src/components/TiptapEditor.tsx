import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import { ListFilter, ImagePlus } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';

// Compression utilities
async function compress(string: string): Promise<string> {
  const byteArray = new TextEncoder().encode(string);
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function decompress(b64: string): Promise<string> {
  const base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const byteArray = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    byteArray[i] = binary.charCodeAt(i);
  }
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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

export function TiptapEditor() {
  const [showMenu, setShowMenu] = useState(false);
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  // Load content
  useEffect(() => {
    const loadContent = async () => {
      try {
        let hash = window.location.hash;
        if (!hash) {
          hash = localStorage.getItem('textarea-hash') ?? '';
        }
        if (hash && hash.startsWith('#')) {
          const decoded = await decompress(hash.slice(1));
          setInitialContent(decoded);
        } else {
          setInitialContent('');
        }
      } catch (e) {
        console.error('Failed to load content:', e);
        setInitialContent('');
      } finally {
        setIsLoading(false);
      }
    };
    loadContent();
  }, []);

  const saveToUrl = useCallback(async (html: string) => {
    if (!html || html === '<p></p>') {
      window.history.replaceState({}, '', window.location.pathname);
      try { localStorage.removeItem('textarea-hash'); } catch (e) { /* ignore */ }
      return;
    }
    const hash = '#' + await compress(html);
    window.history.replaceState({}, '', hash);
    try { localStorage.setItem('textarea-hash', hash); } catch (e) { /* ignore */ }
  }, []);

  const debouncedSave = useCallback(
    debounce((html: string) => saveToUrl(html), 500),
    [saveToUrl]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: false,
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
      const html = editor.getHTML();
      debouncedSave(html);
    },
  }, [initialContent]);

  // Set initial content
  useEffect(() => {
    if (editor && initialContent !== null && initialContent !== '') {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

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

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        downloadAsHtml();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // Update title
  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      const match = text.match(/^(.+)/);
      document.title = match?.[1]?.trim().slice(0, 50) || 'Textarea';
    }
  }, [editor?.storage.characterCount]);

  const downloadAsHtml = useCallback(() => {
    if (!editor) return;
    const text = editor.getText();
    const title = text.split('\n')[0]?.trim().slice(0, 50) || 'Textarea';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html{background:#000;color:#f2f2f2}
    article{max-width:680px;margin:0 auto;padding:48px 24px;font:17px/1.7 'IBM Plex Mono',monospace}
    h1,h2,h3{margin:1.5em 0 .5em;font-weight:600}
    h1{font-size:1.75em}h2{font-size:1.375em}h3{font-size:1.125em}
    p{margin:.75em 0}strong{font-weight:600}em{font-style:italic}
    code{font-family:inherit;background:#1a1a1a;padding:.15em .35em;border-radius:3px}
    blockquote{border-left:2px solid #333;padding-left:1em;margin:1em 0;font-style:italic;color:#888}
    ul,ol{margin:.75em 0;padding-left:1.25em}
    img{max-width:100%;height:auto;border-radius:4px;margin:1em 0}
  </style>
</head>
<body><article>${editor.getHTML()}</article></body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  if (isLoading || initialContent === null) {
    return <div className="min-h-svh bg-background" />;
  }

  return (
    <div 
      className="min-h-svh bg-background flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImagePlus className="w-8 h-8" strokeWidth={1.5} />
            <span className="text-sm">Drop image</span>
          </div>
        </div>
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
        <article className="w-full max-w-2xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-24">
          <EditorContent editor={editor} />
        </article>
      </main>

      {/* Bottom menu button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-muted-foreground/40 hover:text-foreground transition-colors duration-200"
          aria-label="Menu"
        >
          <ListFilter className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Menu popup */}
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-20" 
            onClick={() => setShowMenu(false)} 
          />
          <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
            <div className="text-xs text-muted-foreground font-mono mb-3 px-1">
              {wordCount} words · {charCount} chars
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground/80 hover:bg-accent rounded transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                Add image
              </button>
              <button
                onClick={() => {
                  downloadAsHtml();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground/80 hover:bg-accent rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Save HTML
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
