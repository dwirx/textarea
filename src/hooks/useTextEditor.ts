import { useState, useEffect, useCallback, useRef } from 'react';

async function compress(string: string): Promise<string> {
  const byteArray = new TextEncoder().encode(string);
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  
  // Convert to base64url manually for browser compatibility
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function decompress(b64: string): Promise<string> {
  // Convert from base64url
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

export function useTextEditor() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const getWordCount = useCallback(() => {
    const text = content.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const getCharCount = useCallback(() => {
    return content.length;
  }, [content]);

  const getTitle = useCallback(() => {
    const match = content.match(/^\n*#(.+)\n?/);
    return match?.[1]?.trim() ?? 'Textarea';
  }, [content]);

  const saveToUrl = useCallback(async (text: string) => {
    if (!text) {
      window.history.replaceState({}, '', window.location.pathname);
      try {
        localStorage.removeItem('textarea-hash');
      } catch (e) {
        // Ignore
      }
      return;
    }
    
    const hash = '#' + await compress(text);
    window.history.replaceState({}, '', hash);
    try {
      localStorage.setItem('textarea-hash', hash);
    } catch (e) {
      // Ignore
    }
  }, []);

  const debouncedSave = useCallback(
    debounce((text: string) => saveToUrl(text), 500),
    [saveToUrl]
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    debouncedSave(newContent);
  }, [debouncedSave]);

  const loadFromUrl = useCallback(async () => {
    try {
      let hash = window.location.hash;
      
      if (!hash) {
        hash = localStorage.getItem('textarea-hash') ?? '';
      }
      
      if (hash && hash.startsWith('#')) {
        const decoded = await decompress(hash.slice(1));
        setContent(decoded);
        if (contentRef.current) {
          contentRef.current.textContent = decoded;
        }
      }
    } catch (e) {
      console.error('Failed to load content:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadAsHtml = useCallback(() => {
    const title = getTitle();
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
      background: #faf9f7;
      color: #1f1d1a;
    }
    @media (prefers-color-scheme: dark) {
      html { background: #171513; color: #ebe8e4; }
    }
    article {
      max-width: 680px;
      margin: 0 auto;
      padding: 48px 24px;
      font: 20px/1.8 Georgia, serif;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <article>${content}</article>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, getTitle]);

  useEffect(() => {
    loadFromUrl();
    
    const handleHashChange = () => loadFromUrl();
    window.addEventListener('hashchange', handleHashChange);
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loadFromUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        downloadAsHtml();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [downloadAsHtml]);

  useEffect(() => {
    document.title = getTitle();
  }, [content, getTitle]);

  return {
    content,
    setContent: handleContentChange,
    isLoading,
    wordCount: getWordCount(),
    charCount: getCharCount(),
    title: getTitle(),
    downloadAsHtml,
    contentRef,
  };
}
