import { describe, expect, it } from 'vitest';
import { WeatherToolHandler } from '../../server/apps/weather';

describe('WeatherToolHandler', () => {
  describe('handleToolInvoke', () => {
    it('get_weather with valid location returns temperature, unit, condition, humidity, location', async () => {
      const handler = new WeatherToolHandler();
      const result = await handler.handleToolInvoke('get_weather', { location: 'New York' });

      expect(result.temperature).toBeDefined();
      expect(result.unit).toBeDefined();
      expect(result.condition).toBeDefined();
      expect(result.humidity).toBeDefined();
      expect(result.location).toBeDefined();
    });

    it('get_weather with missing location returns error', async () => {
      const handler = new WeatherToolHandler();
      const result = await handler.handleToolInvoke('get_weather', {});

      expect(result.error).toBeDefined();
    });

    it('unknown tool name returns error', async () => {
      const handler = new WeatherToolHandler();
      const result = await handler.handleToolInvoke('unknown_tool', { location: 'London' });

      expect(result.error).toBeDefined();
    });

    it('location is echoed back in response', async () => {
      const handler = new WeatherToolHandler();
      const result = await handler.handleToolInvoke('get_weather', { location: 'Tokyo' });

      expect(result.location).toBe('Tokyo');
    });

    it('returns numeric temperature and humidity', async () => {
      const handler = new WeatherToolHandler();
      const result = await handler.handleToolInvoke('get_weather', { location: 'Paris' });

      expect(typeof result.temperature).toBe('number');
      expect(typeof result.humidity).toBe('number');
    });
  });
});
