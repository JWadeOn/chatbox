export type InvocationState = 'IDLE' | 'TOOL_REQUESTED' | 'APP_RENDERED' | 'ACTIVE' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';

export type InvocationEvent =
  | 'FUNCTION_CALL'
  | 'IFRAME_LOADED'
  | 'IFRAME_READY'
  | 'APP_COMPLETE'
  | 'APP_ERROR'
  | 'TIMEOUT'
  | 'RESET';

const TERMINAL_STATES: ReadonlySet<InvocationState> = new Set(['COMPLETED', 'ERROR', 'TIMEOUT']);

const TRANSITIONS: Record<string, InvocationState> = {
  'IDLE:FUNCTION_CALL': 'TOOL_REQUESTED',
  'TOOL_REQUESTED:IFRAME_LOADED': 'APP_RENDERED',
  'APP_RENDERED:IFRAME_READY': 'ACTIVE',
  'ACTIVE:APP_COMPLETE': 'COMPLETED',
  'ACTIVE:APP_ERROR': 'ERROR',
  'ACTIVE:TIMEOUT': 'TIMEOUT',
  'COMPLETED:RESET': 'IDLE',
  'ERROR:RESET': 'IDLE',
  'TIMEOUT:RESET': 'IDLE',
};

export class InvocationStateMachine {
  private state: InvocationState = 'IDLE';

  getState(): InvocationState {
    return this.state;
  }

  transition(event: InvocationEvent): InvocationState {
    const key = `${this.state}:${event}`;
    const next = TRANSITIONS[key];
    if (!next) {
      throw new Error(`Invalid transition: ${this.state} + ${event}`);
    }
    this.state = next;
    return this.state;
  }

  reset(): void {
    this.state = 'IDLE';
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.has(this.state);
  }
}
