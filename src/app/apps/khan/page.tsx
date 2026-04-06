'use client';

import { useEffect, useState } from 'react';
import { useIframeSessionPostMessage } from '@/lib/iframe-postmessage';

type QuizData = {
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
};

const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  primary: '#0d9488',
  primaryLight: '#ccfbf1',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  correct: '#16a34a',
  incorrect: '#dc2626',
};

export default function KhanApp() {
  const [topic, setTopic] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ concept: string; text: string } | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [stats, setStats] = useState({ questionsAsked: 0, questionsCorrect: 0, topicsReviewed: 0 });

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

        if (params.tool === 'open_topic') {
          const t = params.arguments?.topic as string;
          if (topic && topic !== t) {
            setStats((s) => ({ ...s, topicsReviewed: s.topicsReviewed + 1 }));
          }
          setTopic(t);
          setExplanation(null);
          setQuiz(null);
          setSelectedAnswer(null);
          sendToParent({
            jsonrpc: '2.0',
            result: { invocationId, topic: t, status: 'opened', message: `Topic loaded: ${t}` },
            id,
          });
        } else if (params.tool === 'explain_concept') {
          const concept = params.arguments?.concept as string;
          const text =
            `${concept} is a key idea in ${topic}. ` +
            `Understanding ${concept} helps build a stronger foundation in this subject. ` +
            `Try connecting it to what you already know and look for real-world examples.`;
          setExplanation({ concept, text });
          setQuiz(null);
          setSelectedAnswer(null);
          sendToParent({ jsonrpc: '2.0', result: { invocationId, topic, concept, explanation: text }, id });
        } else if (params.tool === 'quiz') {
          const q: QuizData = {
            topic: topic || '',
            question: `Which of the following best describes a core principle of ${topic}?`,
            options: [
              `It involves understanding the fundamentals of ${topic}.`,
              'It is unrelated to any other subject area.',
              'It only applies in theoretical contexts.',
              'It was discovered in the last decade.',
            ],
            correctIndex: 0,
          };
          setQuiz(q);
          setExplanation(null);
          setSelectedAnswer(null);
          setStats((s) => ({ ...s, questionsAsked: s.questionsAsked + 1 }));
          sendToParent({
            jsonrpc: '2.0',
            result: { invocationId, topic, question: q.question, options: q.options, correctIndex: q.correctIndex },
            id,
          });
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [topic, sendToParent]);

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

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || !quiz) return;
    setSelectedAnswer(index);
    if (index === quiz.correctIndex) {
      setStats((s) => ({ ...s, questionsCorrect: s.questionsCorrect + 1 }));
    }
    sendToParent({
      jsonrpc: '2.0',
      method: 'app_state_update',
      params: {
        summary: `Answered quiz: ${index === quiz.correctIndex ? 'correct' : 'incorrect'}`,
        topic,
        selectedAnswer: index,
        correct: index === quiz.correctIndex,
      },
    });
  };

  const handleDone = () => {
    sendToParent({
      jsonrpc: '2.0',
      method: 'app_complete',
      params: {
        summary: `Reviewed topic: ${topic}. Questions: ${stats.questionsAsked} asked, ${stats.questionsCorrect} correct. Topics reviewed: ${stats.topicsReviewed + 1}.`,
        data: { topic, ...stats, topicsReviewed: stats.topicsReviewed + 1 },
      },
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', padding: '16px' }}>
      {!topic ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: COLORS.textMuted }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#x1F4D6;</div>
          <div style={{ fontSize: '14px' }}>Waiting for a topic...</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Ask the chatbot about any subject to get started.</div>
        </div>
      ) : (
        <>
          {/* Topic header */}
          <div
            style={{
              background: COLORS.primary,
              color: '#fff',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.5px' }}>
                Current Topic
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{topic}</div>
            </div>
            <button
              type="button"
              onClick={handleDone}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>

          {/* Explanation card */}
          {explanation && (
            <div
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `4px solid ${COLORS.primary}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: COLORS.primary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Explanation: {explanation.concept}
              </div>
              <div style={{ fontSize: '14px', color: COLORS.text, lineHeight: '1.6' }}>{explanation.text}</div>
            </div>
          )}

          {/* Quiz card */}
          {quiz && (
            <div
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: COLORS.primary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Quiz
              </div>
              <div style={{ fontSize: '14px', color: COLORS.text, marginBottom: '12px', fontWeight: 500 }}>
                {quiz.question}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quiz.options.map((opt, i) => {
                  let bg = COLORS.card;
                  let borderColor = COLORS.border;
                  if (selectedAnswer !== null) {
                    if (i === quiz.correctIndex) {
                      bg = '#f0fdf4';
                      borderColor = COLORS.correct;
                    } else if (i === selectedAnswer) {
                      bg = '#fef2f2';
                      borderColor = COLORS.incorrect;
                    }
                  }
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedAnswer !== null}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        fontSize: '13px',
                        color: COLORS.text,
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '6px',
                        cursor: selectedAnswer !== null ? 'default' : 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {selectedAnswer !== null && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: selectedAnswer === quiz.correctIndex ? COLORS.correct : COLORS.incorrect,
                  }}
                >
                  {selectedAnswer === quiz.correctIndex ? 'Correct!' : 'Not quite. Review the topic and try again.'}
                </div>
              )}
            </div>
          )}

          {/* Stats footer */}
          <div style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center', marginTop: '16px' }}>
            Topics: {stats.topicsReviewed + 1} &middot; Questions: {stats.questionsAsked} asked,{' '}
            {stats.questionsCorrect} correct
          </div>
        </>
      )}
    </div>
  );
}
