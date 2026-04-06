type KhanSession = {
  currentTopic: string | null;
  topicsReviewed: string[];
  questionsAsked: number;
  questionsCorrect: number;
};

const TOPIC_HINTS: Record<string, string[]> = {
  default: [
    'This is a foundational topic that connects to many areas of study.',
    'Try thinking about how this applies to everyday life.',
    'Consider what assumptions underlie this concept.',
  ],
};

function pickHint(topic: string, index: number): string {
  const hints = TOPIC_HINTS[topic.toLowerCase()] ?? TOPIC_HINTS.default;
  return hints[index % hints.length];
}

export class KhanToolHandler {
  private sessions = new Map<string, KhanSession>();

  async handleToolInvoke(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'open_topic':
        return this.openTopic(sessionId, params);
      case 'explain_concept':
        return this.explainConcept(sessionId, params);
      case 'quiz':
        return this.quiz(sessionId);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getSession(sessionId: string): KhanSession | undefined {
    return this.sessions.get(sessionId);
  }

  buildAssistantContext(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session?.currentTopic) {
      return '';
    }
    const reviewed = session.topicsReviewed.length
      ? ` Topics reviewed earlier: ${session.topicsReviewed.join(', ')}.`
      : '';
    return `\n\n## Active App Context\nKhan Academy companion: current topic "${session.currentTopic}".${reviewed} Quiz stats: ${session.questionsAsked} question(s) asked, ${session.questionsCorrect} correct.`;
  }

  private openTopic(sessionId: string, params: Record<string, unknown>): Record<string, unknown> {
    const topic = params.topic as string | undefined;
    if (!topic) {
      return { error: 'Missing required parameter: topic' };
    }

    const existing = this.sessions.get(sessionId);
    if (existing?.currentTopic) {
      existing.topicsReviewed.push(existing.currentTopic);
      existing.currentTopic = topic;
    } else {
      this.sessions.set(sessionId, {
        currentTopic: topic,
        topicsReviewed: [],
        questionsAsked: 0,
        questionsCorrect: 0,
      });
    }

    return {
      topic,
      status: 'opened',
      message: `Topic loaded: ${topic}. Ask for explanations or quiz questions.`,
      hint: pickHint(topic, 0),
    };
  }

  private explainConcept(sessionId: string, params: Record<string, unknown>): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session?.currentTopic) {
      return { error: 'No active topic. Use open_topic first.' };
    }

    const concept = params.concept as string | undefined;
    if (!concept) {
      return { error: 'Missing required parameter: concept' };
    }

    return {
      topic: session.currentTopic,
      concept,
      explanation:
        `${concept} is a key idea in ${session.currentTopic}. ` +
        `Understanding ${concept} helps build a stronger foundation in this subject. ` +
        `Try connecting it to what you already know and look for real-world examples.`,
    };
  }

  private quiz(sessionId: string): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session?.currentTopic) {
      return { error: 'No active topic. Use open_topic first.' };
    }

    session.questionsAsked++;
    const topic = session.currentTopic;

    return {
      topic,
      question: `Which of the following best describes a core principle of ${topic}?`,
      options: [
        `It involves understanding the fundamentals of ${topic}.`,
        `It is unrelated to any other subject area.`,
        `It only applies in theoretical contexts.`,
        `It was discovered in the last decade.`,
      ],
      correctIndex: 0,
    };
  }
}
