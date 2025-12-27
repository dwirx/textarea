import { X } from 'lucide-react';

interface HelpPanelProps {
  onClose: () => void;
}

export function HelpPanel({ onClose }: HelpPanelProps) {
  const shortcuts = [
    { category: 'Headings', items: [
      { keys: '# ', desc: 'Heading 1' },
      { keys: '## ', desc: 'Heading 2' },
      { keys: '### ', desc: 'Heading 3' },
    ]},
    { category: 'Text Formatting', items: [
      { keys: '**text**', desc: 'Bold' },
      { keys: '*text*', desc: 'Italic' },
      { keys: '~~text~~', desc: 'Strikethrough' },
      { keys: '`code`', desc: 'Inline code' },
    ]},
    { category: 'Lists', items: [
      { keys: '- ', desc: 'Bullet list' },
      { keys: '* ', desc: 'Bullet list' },
      { keys: '1. ', desc: 'Numbered list' },
      { keys: '[ ] ', desc: 'Task list' },
      { keys: '[x] ', desc: 'Completed task' },
    ]},
    { category: 'Blocks', items: [
      { keys: '> ', desc: 'Blockquote' },
      { keys: '```', desc: 'Code block' },
      { keys: '---', desc: 'Horizontal rule' },
    ]},
    { category: 'Links', items: [
      { keys: 'Paste URL', desc: 'Auto-link' },
      { keys: '[text](url)', desc: 'Link with text' },
    ]},
    { category: 'Keyboard Shortcuts', items: [
      { keys: 'Cmd/Ctrl + B', desc: 'Bold' },
      { keys: 'Cmd/Ctrl + I', desc: 'Italic' },
      { keys: 'Cmd/Ctrl + Z', desc: 'Undo' },
      { keys: 'Cmd/Ctrl + Shift + Z', desc: 'Redo' },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" strokeWidth={1.5} />
      </button>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 sm:px-12 pt-12 pb-24">
        <h1 className="text-xl font-mono text-neutral-200 mb-8">Markdown Shortcuts</h1>
        
        <div className="space-y-8">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h2 className="text-sm font-mono text-neutral-500 mb-4 uppercase tracking-wider">
                {section.category}
              </h2>
              <div className="space-y-2">
                {section.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-neutral-900">
                    <code className="text-sm font-mono text-neutral-300 bg-neutral-900 px-2 py-1 rounded">
                      {item.keys}
                    </code>
                    <span className="text-sm font-mono text-neutral-500">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Example section */}
        <div className="mt-12 pt-8 border-t border-neutral-900">
          <h2 className="text-sm font-mono text-neutral-500 mb-4 uppercase tracking-wider">
            Example
          </h2>
          <div className="bg-neutral-900 rounded-lg p-4 font-mono text-sm text-neutral-300 whitespace-pre-wrap">
{`# My Note Title

This is a paragraph with **bold** and *italic* text.

## Section Header

- First item
- Second item
- Third item

### Subsection

> This is a blockquote for important notes.

1. Numbered item one
2. Numbered item two

[ ] Todo item
[x] Completed item

Here's some \`inline code\` and a code block:

\`\`\`
const hello = "world";
console.log(hello);
\`\`\`

---

Visit https://example.com for more info.`}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
          <h3 className="text-sm font-mono text-neutral-400 mb-2">Tips</h3>
          <ul className="text-sm font-mono text-neutral-500 space-y-1">
            <li>• Type markdown syntax at the start of a line</li>
            <li>• Wrap text in symbols for inline formatting</li>
            <li>• Paste URLs to auto-create links</li>
            <li>• Drag & drop or paste images</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
