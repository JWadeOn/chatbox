type MessageBubbleProps = {
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system' || role === 'tool_result';

  if (isSystem) {
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
