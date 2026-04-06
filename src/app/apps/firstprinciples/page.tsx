'use client';

import { useEffect, useState } from 'react';
import { useIframeSessionPostMessage } from '@/lib/iframe-postmessage';

type Analysis = {
  question: string;
  assumptions: string[];
  principles: string[];
  reasoning_steps: string[];
  conclusion: string;
};

const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  assumption: '#8b5cf6',
  principle: '#0891b2',
  step: '#2563eb',
  conclusion: '#059669',
};

export default function FirstPrinciplesApp() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const sendToParent = useIframeSessionPostMessage();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.method === 'tool_invoke') {
        const params = data.params as { tool: string; arguments: Record<string, unknown>; invocationId?: string };
        const id = data.id as number;
        const invocationId = params.invocationId;

        if (params.tool === 'analyze') {
          const question = params.arguments?.question as string;
          const words = question
            .replace(/[?.!,]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3);
          const keyTerms = words.slice(0, 3).map((w) => w.toLowerCase());
          const subject = keyTerms.join(' and ');

          const result: Analysis = {
            question,
            assumptions: [
              `The question assumes a shared understanding of ${keyTerms[0] || 'the subject'}.`,
              `It assumes that ${subject || 'this topic'} can be analyzed through observable evidence.`,
              'It presupposes that a clear, communicable answer exists.',
            ],
            principles: [
              `Break ${subject || 'the problem'} into its smallest verifiable components.`,
              'Identify which parts are established facts vs. inferences.',
              'Test each component independently before combining them.',
            ],
            reasoning_steps: [
              `Define the core question: "${question}"`,
              `Identify the key concepts: ${keyTerms.length > 0 ? keyTerms.join(', ') : 'as stated in the question'}.`,
              'Separate what is known from what is assumed about each concept.',
              'Rebuild understanding from verified foundations upward.',
            ],
            conclusion:
              `By decomposing "${question}" into first principles, we can examine each component ` +
              'on its own merits rather than relying on analogies or assumptions. ' +
              'This approach reveals which parts of our understanding are well-founded ' +
              'and which need further investigation.',
          };

          setAnalysis(result);
          sendToParent({ jsonrpc: '2.0', result: { invocationId, ...result }, id });

          // Auto-complete after rendering
          setTimeout(() => {
            sendToParent({
              jsonrpc: '2.0',
              method: 'app_complete',
              params: {
                summary: `Analyzed: "${question}". Found ${result.assumptions.length} assumptions, ${result.principles.length} principles, ${result.reasoning_steps.length} reasoning steps.`,
                data: {
                  question,
                  assumptionCount: result.assumptions.length,
                  principleCount: result.principles.length,
                  stepCount: result.reasoning_steps.length,
                },
              },
            });
          }, 500);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToParent]);

  // Signal iframe_ready
  useEffect(() => {
    const signal = () => sendToParent({ jsonrpc: '2.0', method: 'iframe_ready', params: {} });
    signal();
    const interval = setInterval(signal, 500);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sendToParent]);

  if (!analysis) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.bg,
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: COLORS.textMuted }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#x1F9E0;</div>
          <div style={{ fontSize: '14px' }}>Waiting for a question to analyze...</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Ask the chatbot to break down any concept or question.
          </div>
        </div>
      </div>
    );
  }

  const Section = ({
    title,
    color,
    items,
    ordered,
  }: {
    title: string;
    color: string;
    items: string[];
    ordered?: boolean;
  }) => (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
        }}
      >
        {title}
      </div>
      {ordered ? (
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          {items.map((item) => (
            <li key={item} style={{ fontSize: '13px', color: COLORS.text, lineHeight: '1.7', marginBottom: '4px' }}>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {items.map((item) => (
            <li key={item} style={{ fontSize: '13px', color: COLORS.text, lineHeight: '1.7', marginBottom: '4px' }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', padding: '16px' }}>
      {/* Question header */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: COLORS.textMuted,
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Question
        </div>
        <div style={{ fontSize: '16px', color: COLORS.text, fontWeight: 500 }}>{analysis.question}</div>
      </div>

      <Section title="Assumptions" color={COLORS.assumption} items={analysis.assumptions} />
      <Section title="First Principles" color={COLORS.principle} items={analysis.principles} />
      <Section title="Reasoning Steps" color={COLORS.step} items={analysis.reasoning_steps} ordered />

      {/* Conclusion */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderLeft: `4px solid ${COLORS.conclusion}`,
          borderRadius: '8px',
          padding: '14px 16px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: COLORS.conclusion,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Conclusion
        </div>
        <div style={{ fontSize: '13px', color: COLORS.text, lineHeight: '1.7' }}>{analysis.conclusion}</div>
      </div>
    </div>
  );
}
