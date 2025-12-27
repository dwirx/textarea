import { useTextEditor } from '@/hooks/useTextEditor';
import { Download, FileText } from 'lucide-react';
import { useEffect } from 'react';

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

  useEffect(() => {
    if (!isLoading && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isLoading, contentRef]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.textContent ?? '');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium font-mono">Textarea</span>
          </div>
          
          <button
            onClick={downloadAsHtml}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors duration-200"
            title="Download as HTML (⌘S)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1 fade-in">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div
            ref={contentRef}
            contentEditable="plaintext-only"
            spellCheck
            onInput={handleInput}
            className="editor-content min-h-[60vh] focus:outline-none"
            suppressContentEditableWarning
          >
            {content}
          </div>
        </div>
      </main>

      {/* Footer Stats */}
      <footer className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border/50">
        <div className="max-w-3xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono slide-up">
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span className="text-border">•</span>
            <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
          </div>
          
          <div className="text-xs text-muted-foreground/60 font-mono">
            <span className="hidden sm:inline">Auto-saved to URL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
