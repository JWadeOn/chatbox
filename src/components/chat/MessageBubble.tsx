import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MessageBubbleProps = {
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system' || role === 'tool_result';

  if (isSystem) {
    const isToolCall = content.startsWith('[');
    if (isToolCall) {
      const match = content.match(/^\[(.+?)\] (.+?)\((.+?)\) → (.+)$/);
      if (match) {
        const [, appSlug, toolName, , result] = match;
        let parsedResult: Record<string, unknown> = {};
        try {
          parsedResult = JSON.parse(result);
        } catch {
          parsedResult = { raw: result };
        }

        return (
          <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50 text-xs">
            <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-100 px-3 py-1.5">
              <span className="font-semibold text-indigo-700">{appSlug}</span>
              <span className="text-indigo-500">{toolName}</span>
            </div>
            <div className="px-3 py-2">
              {'error' in parsedResult ? (
                <span className="text-red-600">Error: {String(parsedResult.error)}</span>
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">
                  {JSON.stringify(parsedResult, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      }
    }

    return (
      <div className="mx-auto max-w-lg rounded-md bg-gray-100 px-3 py-1.5 text-center text-xs text-gray-500 italic">
        {content}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white">
          {content}
        </div>
      </div>
    );
  }

  // Assistant message — render markdown
  return (
    <div className="flex justify-start">
      <div className="prose prose-sm max-w-[75%] rounded-2xl bg-gray-100 px-4 py-2.5 text-gray-900">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
            ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
            li: ({ children }) => <li className="mb-0.5">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <pre className="my-2 overflow-x-auto rounded-md bg-gray-800 p-3 text-xs text-gray-100">
                    <code>{children}</code>
                  </pre>
                );
              }
              return <code className="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono">{children}</code>;
            },
            h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-1 text-sm font-bold">{children}</h3>,
            blockquote: ({ children }) => (
              <blockquote className="my-2 border-l-2 border-gray-300 pl-3 italic text-gray-600">{children}</blockquote>
            ),
            table: ({ children }) => (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full text-xs">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b border-gray-300 px-2 py-1 text-left font-semibold">{children}</th>
            ),
            td: ({ children }) => <td className="border-b border-gray-200 px-2 py-1">{children}</td>,
          }}
        >
          {content}
        </Markdown>
      </div>
    </div>
  );
}
