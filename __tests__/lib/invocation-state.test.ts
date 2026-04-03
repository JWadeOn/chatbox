import { describe, expect, it } from 'vitest';
import { InvocationStateMachine } from '../../server/lib/invocation-state';

describe('InvocationStateMachine', () => {
  describe('initial state', () => {
    it('starts in IDLE', () => {
      const sm = new InvocationStateMachine();
      expect(sm.getState()).toBe('IDLE');
    });
  });

  describe('valid transitions', () => {
    it('IDLE + FUNCTION_CALL → TOOL_REQUESTED', () => {
      const sm = new InvocationStateMachine();
      const next = sm.transition('FUNCTION_CALL');
      expect(next).toBe('TOOL_REQUESTED');
      expect(sm.getState()).toBe('TOOL_REQUESTED');
    });

    it('TOOL_REQUESTED + IFRAME_LOADED → APP_RENDERED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      const next = sm.transition('IFRAME_LOADED');
      expect(next).toBe('APP_RENDERED');
      expect(sm.getState()).toBe('APP_RENDERED');
    });

    it('APP_RENDERED + IFRAME_READY → ACTIVE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      const next = sm.transition('IFRAME_READY');
      expect(next).toBe('ACTIVE');
      expect(sm.getState()).toBe('ACTIVE');
    });

    it('ACTIVE + APP_COMPLETE → COMPLETED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      const next = sm.transition('APP_COMPLETE');
      expect(next).toBe('COMPLETED');
      expect(sm.getState()).toBe('COMPLETED');
    });

    it('ACTIVE + TIMEOUT → TIMEOUT', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      const next = sm.transition('TIMEOUT');
      expect(next).toBe('TIMEOUT');
      expect(sm.getState()).toBe('TIMEOUT');
    });

    it('ACTIVE + APP_ERROR → ERROR', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      const next = sm.transition('APP_ERROR');
      expect(next).toBe('ERROR');
      expect(sm.getState()).toBe('ERROR');
    });

    it('COMPLETED + RESET → IDLE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_COMPLETE');
      const next = sm.transition('RESET');
      expect(next).toBe('IDLE');
      expect(sm.getState()).toBe('IDLE');
    });

    it('ERROR + RESET → IDLE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_ERROR');
      const next = sm.transition('RESET');
      expect(next).toBe('IDLE');
      expect(sm.getState()).toBe('IDLE');
    });

    it('TIMEOUT + RESET → IDLE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('TIMEOUT');
      const next = sm.transition('RESET');
      expect(next).toBe('IDLE');
      expect(sm.getState()).toBe('IDLE');
    });
  });

  describe('invalid transitions', () => {
    it('throws on IDLE + APP_COMPLETE', () => {
      const sm = new InvocationStateMachine();
      expect(() => sm.transition('APP_COMPLETE')).toThrow(Error);
    });

    it('throws on IDLE + IFRAME_LOADED', () => {
      const sm = new InvocationStateMachine();
      expect(() => sm.transition('IFRAME_LOADED')).toThrow(Error);
    });

    it('throws on IDLE + IFRAME_READY', () => {
      const sm = new InvocationStateMachine();
      expect(() => sm.transition('IFRAME_READY')).toThrow(Error);
    });

    it('throws on IDLE + RESET', () => {
      const sm = new InvocationStateMachine();
      expect(() => sm.transition('RESET')).toThrow(Error);
    });

    it('throws on TOOL_REQUESTED + APP_COMPLETE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      expect(() => sm.transition('APP_COMPLETE')).toThrow(Error);
    });

    it('throws on TOOL_REQUESTED + FUNCTION_CALL', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      expect(() => sm.transition('FUNCTION_CALL')).toThrow(Error);
    });

    it('throws on APP_RENDERED + APP_COMPLETE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      expect(() => sm.transition('APP_COMPLETE')).toThrow(Error);
    });

    it('throws on ACTIVE + FUNCTION_CALL', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      expect(() => sm.transition('FUNCTION_CALL')).toThrow(Error);
    });

    it('throws on COMPLETED + APP_COMPLETE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_COMPLETE');
      expect(() => sm.transition('APP_COMPLETE')).toThrow(Error);
    });
  });

  describe('transition() return value', () => {
    it('returns the new state after each transition', () => {
      const sm = new InvocationStateMachine();
      expect(sm.transition('FUNCTION_CALL')).toBe('TOOL_REQUESTED');
      expect(sm.transition('IFRAME_LOADED')).toBe('APP_RENDERED');
      expect(sm.transition('IFRAME_READY')).toBe('ACTIVE');
      expect(sm.transition('APP_COMPLETE')).toBe('COMPLETED');
      expect(sm.transition('RESET')).toBe('IDLE');
    });
  });

  describe('isTerminal()', () => {
    it('returns false for IDLE', () => {
      const sm = new InvocationStateMachine();
      expect(sm.isTerminal()).toBe(false);
    });

    it('returns false for TOOL_REQUESTED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      expect(sm.isTerminal()).toBe(false);
    });

    it('returns false for APP_RENDERED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      expect(sm.isTerminal()).toBe(false);
    });

    it('returns false for ACTIVE', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      expect(sm.isTerminal()).toBe(false);
    });

    it('returns true for COMPLETED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_COMPLETE');
      expect(sm.isTerminal()).toBe(true);
    });

    it('returns true for ERROR', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_ERROR');
      expect(sm.isTerminal()).toBe(true);
    });

    it('returns true for TIMEOUT', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('TIMEOUT');
      expect(sm.isTerminal()).toBe(true);
    });
  });

  describe('reset()', () => {
    it('resets to IDLE from COMPLETED', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_COMPLETE');
      sm.reset();
      expect(sm.getState()).toBe('IDLE');
    });

    it('resets to IDLE from ERROR', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('APP_ERROR');
      sm.reset();
      expect(sm.getState()).toBe('IDLE');
    });

    it('resets to IDLE from TIMEOUT', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.transition('IFRAME_LOADED');
      sm.transition('IFRAME_READY');
      sm.transition('TIMEOUT');
      sm.reset();
      expect(sm.getState()).toBe('IDLE');
    });

    it('resets to IDLE from any state', () => {
      const sm = new InvocationStateMachine();
      sm.transition('FUNCTION_CALL');
      sm.reset();
      expect(sm.getState()).toBe('IDLE');
    });
  });
});
