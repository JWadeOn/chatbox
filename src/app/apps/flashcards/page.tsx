'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIframeSessionPostMessage } from '@/lib/iframe-postmessage';

type Card = { front: string; back: string };
type Deck = { id: string; title: string; description?: string; cards: Card[]; cardCount: number };

const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  primary: '#2563eb',
  primaryLight: '#eff6ff',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  correct: '#16a34a',
  correctBg: '#f0fdf4',
  incorrect: '#dc2626',
  incorrectBg: '#fef2f2',
  progress: '#2563eb',
};

export default function FlashcardsApp() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<('correct' | 'incorrect')[]>([]);
  const [finished, setFinished] = useState(false);

  const sendToParent = useIframeSessionPostMessage();

  const markCard = useCallback(
    (correct: boolean) => {
      if (!deck) return;
      const result = correct ? 'correct' : 'incorrect';
      const newResults = [...results, result as 'correct' | 'incorrect'];
      setResults(newResults);

      sendToParent({
        jsonrpc: '2.0',
        method: 'app_state_update',
        params: {
          summary: `Card ${currentIndex + 1}/${deck.cardCount}: ${result}`,
          cardIndex: currentIndex,
          correct,
        },
      });

      if (currentIndex + 1 >= deck.cardCount) {
        setFinished(true);
        const correctCount = newResults.filter((r) => r === 'correct').length;
        sendToParent({
          jsonrpc: '2.0',
          method: 'app_complete',
          params: {
            summary: `Studied deck "${deck.title}": ${deck.cardCount}/${deck.cardCount} cards, ${correctCount} correct.`,
            data: { deckId: deck.id, title: deck.title, cardsSeen: deck.cardCount, cardsCorrect: correctCount },
          },
        });
      } else {
        setCurrentIndex((i) => i + 1);
        setFlipped(false);
      }
    },
    [deck, currentIndex, results, sendToParent]
  );

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

        if (params.tool === 'load_deck' || params.tool === 'create_deck') {
          // Parent relays the tool result which contains the deck data
          // For load_deck the result comes back from the server handler
          // We receive the deck in the arguments as passed by the server result
          const deckData = params.arguments as unknown as {
            deck: Deck;
            currentCard?: number;
            status?: string;
          };
          if (deckData?.deck) {
            setDeck(deckData.deck);
            setCurrentIndex(deckData.currentCard ?? 0);
            setFlipped(false);
            setResults([]);
            setFinished(false);
            sendToParent({
              jsonrpc: '2.0',
              result: { invocationId, loaded: true, deckId: deckData.deck.id, cardCount: deckData.deck.cardCount },
              id,
            });
          } else {
            sendToParent({ jsonrpc: '2.0', result: { invocationId, error: 'No deck data received' }, id });
          }
        } else if (params.tool === 'answer_card') {
          const result = params.arguments as unknown as {
            correct: boolean;
            expected: string;
            cardIndex: number;
            nextCard: number | null;
          };
          sendToParent({ jsonrpc: '2.0', result: { invocationId, ...result }, id });
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

  if (!deck) {
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
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#x1F4DD;</div>
          <div style={{ fontSize: '14px' }}>Waiting for a deck...</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Ask the chatbot to create or load flashcards.</div>
        </div>
      </div>
    );
  }

  if (finished) {
    const correctCount = results.filter((r) => r === 'correct').length;
    const pct = Math.round((correctCount / deck.cardCount) * 100);
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', padding: '16px' }}>
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
            maxWidth: '400px',
            margin: '40px auto',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{pct >= 80 ? '\u2B50' : '\u{1F4AA}'}</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: COLORS.text, marginBottom: '4px' }}>
            Session Complete
          </div>
          <div style={{ fontSize: '14px', color: COLORS.textMuted, marginBottom: '20px' }}>{deck.title}</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              fontSize: '14px',
              color: COLORS.text,
            }}
          >
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.correct }}>{correctCount}</div>
              <div style={{ color: COLORS.textMuted }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.incorrect }}>
                {deck.cardCount - correctCount}
              </div>
              <div style={{ color: COLORS.textMuted }}>Missed</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.primary }}>{pct}%</div>
              <div style={{ color: COLORS.textMuted }}>Score</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const card = deck.cards[currentIndex];
  const progress = (currentIndex / deck.cardCount) * 100;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text }}>{deck.title}</div>
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
          Card {currentIndex + 1} of {deck.cardCount}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          background: COLORS.border,
          borderRadius: '4px',
          height: '4px',
          marginBottom: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: COLORS.progress,
            height: '100%',
            width: `${progress}%`,
            transition: 'width 0.3s ease',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={() => setFlipped(!flipped)}
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s',
          width: '100%',
          font: 'inherit',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
          }}
        >
          {flipped ? 'Answer' : 'Question'} &middot; Tap to flip
        </div>
        <div style={{ fontSize: '18px', color: COLORS.text, fontWeight: flipped ? 400 : 500, lineHeight: '1.5' }}>
          {flipped ? card.back : card.front}
        </div>
      </button>

      {/* Action buttons — only show when flipped */}
      {flipped && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => markCard(false)}
            style={{
              flex: 1,
              maxWidth: '160px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: COLORS.incorrect,
              background: COLORS.incorrectBg,
              border: `1px solid ${COLORS.incorrect}`,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Missed it
          </button>
          <button
            type="button"
            onClick={() => markCard(true)}
            style={{
              flex: 1,
              maxWidth: '160px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: COLORS.correct,
              background: COLORS.correctBg,
              border: `1px solid ${COLORS.correct}`,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
