import { useTextEditor } from '@/hooks/useTextEditor';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

export function TextEditor() {
  const {
    content,
    setContent,
    isLoading,
    wordCount,
    charCount,
    downloadAsHtml,
    contentRef,
  } = useTextEditor();

  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    if (!isLoading && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isLoading, contentRef]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.textContent ?? '');
  };

  // Hide stats after 2.5 seconds of no interaction
  useEffect(() => {
    setShowStats(true);
    const timer = setTimeout(() => setShowStats(false), 2500);
    return () => clearTimeout(timer);
  }, [content]);

  if (isLoading) {
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
      {/* Editor - no top padding, just essential spacing */}
      <main className="flex-1">
        <article className="w-full max-w-2xl mx-auto px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-20">
          <div
            ref={contentRef}
            contentEditable="plaintext-only"
            spellCheck
            onInput={handleInput}
            className="editor-content min-h-[calc(100svh-6rem)] focus:outline-none"
            suppressContentEditableWarning
          >
            {content}
          </div>
        </article>
      </main>

      {/* Floating Stats - minimal, appears on activity */}
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
