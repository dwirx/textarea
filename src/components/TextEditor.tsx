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

  // Hide stats after 3 seconds of no interaction
  useEffect(() => {
    setShowStats(true);
    const timer = setTimeout(() => setShowStats(false), 3000);
    return () => clearTimeout(timer);
  }, [content]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background flex flex-col"
      onMouseMove={() => setShowStats(true)}
    >
      {/* Editor */}
      <main className="flex-1 animate-fade-in">
        <article className="max-w-2xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
          <div
            ref={contentRef}
            contentEditable="plaintext-only"
            spellCheck
            onInput={handleInput}
            className="editor-content min-h-[70vh] focus:outline-none"
            suppressContentEditableWarning
          >
            {content}
          </div>
        </article>
      </main>

      {/* Floating Stats - appears on hover/activity */}
      <div 
        className={`fixed bottom-0 left-0 right-0 transition-all duration-500 ${
          showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div className="max-w-2xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground/70 font-mono tracking-wide">
            <span>{wordCount}w</span>
            <span className="text-border/50">·</span>
            <span>{charCount}c</span>
          </div>
          
          <button
            onClick={downloadAsHtml}
            className="p-2 text-muted-foreground/50 hover:text-foreground rounded-full hover:bg-secondary/50 transition-all duration-200"
            title="Save as HTML (⌘S)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
