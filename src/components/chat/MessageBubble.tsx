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
      // Parse tool call display: [appSlug] toolName(args) → result
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

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
