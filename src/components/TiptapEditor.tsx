import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { Download } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

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

export function TiptapEditor() {
  const [showStats, setShowStats] = useState(true);
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load content from URL hash or localStorage
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

  const saveToUrl = useCallback(async (text: string) => {
    if (!text) {
      window.history.replaceState({}, '', window.location.pathname);
      try { localStorage.removeItem('textarea-hash'); } catch (e) { /* ignore */ }
      return;
    }
    const hash = '#' + await compress(text);
    window.history.replaceState({}, '', hash);
    try { localStorage.setItem('textarea-hash', hash); } catch (e) { /* ignore */ }
  }, []);

  const debouncedSave = useCallback(
    debounce((text: string) => saveToUrl(text), 500),
    [saveToUrl]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Write something...',
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      CharacterCount,
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[calc(100svh-6rem)]',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      debouncedSave(text);
      setShowStats(true);
    },
  }, [initialContent]);

  // Update editor content when initialContent loads
  useEffect(() => {
    if (editor && initialContent !== null && !editor.getText()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Auto-hide stats
  useEffect(() => {
    if (showStats) {
      const timer = setTimeout(() => setShowStats(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showStats, editor?.storage.characterCount]);

  // Keyboard shortcut for download
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

  // Update document title
  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      const match = text.match(/^#(.+)/);
      document.title = match?.[1]?.trim() ?? 'Textarea';
    }
  }, [editor?.storage.characterCount]);

  const downloadAsHtml = useCallback(() => {
    if (!editor) return;
    
    const text = editor.getText();
    const match = text.match(/^#(.+)/);
    const title = match?.[1]?.trim() ?? 'Textarea';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { 
      color-scheme: light dark;
      background: #faf8f6;
      color: #1f1d1a;
    }
    @media (prefers-color-scheme: dark) {
      html { background: #161412; color: #e8e5e1; }
    }
    article {
      max-width: 680px;
      margin: 0 auto;
      padding: 48px 24px;
      font: 20px/1.8 Georgia, serif;
    }
    h1, h2, h3 { margin: 1.5em 0 0.5em; font-weight: 600; }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.75em 0; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    code { font-family: monospace; background: rgba(0,0,0,0.05); padding: 0.2em 0.4em; border-radius: 3px; }
    blockquote { border-left: 3px solid rgba(0,0,0,0.2); padding-left: 1em; margin: 1em 0; font-style: italic; }
    ul, ol { margin: 0.75em 0; padding-left: 1.5em; }
  </style>
</head>
<body>
  <article>${editor.getHTML()}</article>
</body>
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
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-muted-foreground/50 animate-pulse text-sm">...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-svh bg-background flex flex-col"
      onMouseMove={() => setShowStats(true)}
      onTouchStart={() => setShowStats(true)}
    >
      {/* Editor */}
      <main className="flex-1">
        <article className="w-full max-w-2xl mx-auto px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-20">
          <EditorContent editor={editor} />
        </article>
      </main>

      {/* Floating Stats */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-10 transition-all duration-300 ease-out ${
          showStats 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-1 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-3">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground/60 font-mono tracking-wider">
              <span>{wordCount} words</span>
              <span className="text-border/40">·</span>
              <span>{charCount} chars</span>
            </div>
            
            <button
              onClick={downloadAsHtml}
              className="p-2 -m-2 text-muted-foreground/40 hover:text-foreground active:scale-95 rounded-full transition-all duration-200"
              title="Save as HTML (⌘S)"
              aria-label="Download as HTML"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
