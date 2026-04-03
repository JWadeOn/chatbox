/**
 * Chatbox-derived Markdown renderer.
 *
 * Extracted from chatbox/src/renderer/components/Markdown.tsx and adapted:
 *   - Tailwind CSS instead of MUI/Mantine
 *   - Removed Electron-specific features (deploy, artifact preview)
 *   - Removed i18n dependency
 *   - Kept: react-markdown + remark-gfm + remark-math + rehype-katex
 *   - Kept: Prism syntax highlighting with language detection
 *   - Kept: URL sanitization, LaTeX processing, code-block collapse
 *   - Kept: Code index tracking for streaming awareness
 */

'use client';

import { sanitizeUrl } from '@braintree/sanitize-url';
import { memo, useCallback, useContext, useMemo, useState, createContext, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Code block collapse state (derived from Chatbox BlockCodeCollapsedStateProvider)
// ---------------------------------------------------------------------------

const CODE_BLOCK_COLLAPSE_LINE_THRESHOLD = 7;

type CollapseContextType = {
  isCollapsed: (id: string) => boolean;
  toggle: (id: string) => void;
};

const CollapseContext = createContext<CollapseContextType | undefined>(undefined);

function CodeCollapseProvider({ children, defaultCollapsed = false }: { children: ReactNode; defaultCollapsed?: boolean }) {
  const [states, setStates] = useState<Record<string, boolean>>({});

  const isCollapsed = useCallback(
    (id: string) => states[id] ?? defaultCollapsed,
    [states, defaultCollapsed]
  );

  const toggle = useCallback(
    (id: string) => setStates((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultCollapsed) })),
    [defaultCollapsed]
  );

  const value = useMemo(() => ({ isCollapsed, toggle }), [isCollapsed, toggle]);
  return <CollapseContext.Provider value={value}>{children}</CollapseContext.Provider>;
}

function useCollapseState(id: string) {
  const ctx = useContext(CollapseContext);
  if (!ctx) return { collapsed: false, toggle: () => {} };
  return { collapsed: ctx.isCollapsed(id), toggle: () => ctx.toggle(id) };
}

// ---------------------------------------------------------------------------
// Remark plugin: add data-code-index to code blocks (from Chatbox)
// ---------------------------------------------------------------------------

function remarkAddCodeIndex() {
  // biome-ignore lint/suspicious/noExplicitAny: remark AST nodes are loosely typed
  return (tree: any) => {
    let counter = 0;
    visit(tree, 'code', (node) => {
      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      node.data.hProperties['data-code-index'] = counter++;
    });
  };
}

// ---------------------------------------------------------------------------
// LaTeX preprocessing (simplified from Chatbox's latex package)
// ---------------------------------------------------------------------------

function processLaTeX(content: string): string {
  // Protect display math $$...$$ from being broken by remark-breaks
  return content
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

// ---------------------------------------------------------------------------
// Language icon map (simplified from Chatbox)
// ---------------------------------------------------------------------------

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'React JSX',
  tsx: 'React TSX',
  py: 'Python',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  bash: 'Bash',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  md: 'Markdown',
  dockerfile: 'Dockerfile',
  text: 'Text',
};

// ---------------------------------------------------------------------------
// BlockCode component (derived from Chatbox)
// ---------------------------------------------------------------------------

const BlockCode = memo(function BlockCode({
  children,
  language,
  uniqueId,
  generating,
}: {
  children: string;
  language: string;
  uniqueId?: string;
  generating?: boolean;
}) {
  const label = LANG_LABELS[language.toLowerCase()] || language.toUpperCase();
  const [copied, setCopied] = useState(false);
  const needCollapse = !!uniqueId && children.split('\n').length > CODE_BLOCK_COLLAPSE_LINE_THRESHOLD;
  const { collapsed, toggle } = useCollapseState(uniqueId || '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="my-2 overflow-hidden rounded-md border border-gray-700">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {generating && (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
          )}
          <span className="font-mono text-xs font-semibold text-gray-400">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {needCollapse && (
            <button
              type="button"
              onClick={toggle}
              className="rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
        </div>
      </div>

      {/* Code content */}
      <div className={needCollapse && collapsed ? 'max-h-40 overflow-hidden' : ''}>
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          showLineNumbers
          customStyle={{
            margin: 0,
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CodeRenderer (derived from Chatbox)
// ---------------------------------------------------------------------------

const CodeRenderer = memo(function CodeRenderer(props: {
  children: string;
  className?: string;
  uniqueId?: string;
  generating?: boolean;
}) {
  const { children, className, uniqueId, generating } = props;
  const language = /language-(\w+)/.exec(className || '')?.[1] || 'text';

  // Inline code
  if (!String(children).includes('\n')) {
    return (
      <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs dark:bg-gray-700 dark:text-gray-200">
        {children}
      </code>
    );
  }

  return <BlockCode language={language} uniqueId={uniqueId} generating={generating}>{children}</BlockCode>;
});

// ---------------------------------------------------------------------------
// Markdown component (derived from Chatbox)
// ---------------------------------------------------------------------------

type MarkdownProps = {
  children: string;
  uniqueId?: string;
  className?: string;
  generating?: boolean;
};

function MarkdownComponent({ children, uniqueId, className, generating }: MarkdownProps) {
  const codeFences = useMemo(() => (children.match(/```/g) || []).length, [children]);
  const generatingCodeIndex = useMemo(
    () => (codeFences % 2 === 0 ? -1 : Math.floor(codeFences / 2)),
    [codeFences]
  );

  return (
    <div className={`break-words ${className || ''}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks, remarkAddCodeIndex]}
      rehypePlugins={[rehypeKatex]}
      urlTransform={(url) => sanitizeUrl(url)}
      components={useMemo(
        () => ({
          // biome-ignore lint/suspicious/noExplicitAny: react-markdown code props are loosely typed
          code: (props: any) => {
            const codeIndex =
              typeof props['data-code-index'] === 'number' ? props['data-code-index'] : -1;
            return (
              <CodeRenderer
                {...props}
                uniqueId={uniqueId ? `${uniqueId}-code-${codeIndex}` : undefined}
                generating={generating && generatingCodeIndex === codeIndex}
              />
            );
          },
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800" />
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-sm font-bold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-gray-300 pl-3 italic text-gray-600">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-gray-300 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-gray-200 px-2 py-1">{children}</td>
          ),
          hr: () => <hr className="my-4 border-gray-200" />,
        }),
        [uniqueId, generating, generatingCodeIndex]
      )}
    >
      {processLaTeX(children)}
    </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownComponent);
export { CodeCollapseProvider };
