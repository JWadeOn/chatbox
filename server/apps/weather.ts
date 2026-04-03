interface WeatherResult {
  temperature: number;
  unit: string;
  condition: string;
  humidity: number;
  location: string;
}

interface WeatherError {
  error: string;
}

type WeatherResponse = WeatherResult | WeatherError;

/**
 * Generates a deterministic mock weather response based on the location string.
 * Uses a simple hash of the location to produce realistic-looking data.
 */
function getMockWeather(location: string): WeatherResult {
  const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Thunderstorm', 'Snowy', 'Windy', 'Foggy'];

  // Simple hash to get deterministic but varied results per location
  let hash = 0;
  for (let i = 0; i < location.length; i++) {
    hash = (hash * 31 + location.charCodeAt(i)) | 0;
  }
  const positiveHash = Math.abs(hash);

  const temperature = (positiveHash % 45) - 5; // range: -5 to 39
  const humidity = (positiveHash % 61) + 30; // range: 30 to 90
  const condition = conditions[positiveHash % conditions.length];

  return {
    temperature,
    unit: 'celsius',
    condition,
    humidity,
    location,
  };
}

export class WeatherToolHandler {
  async handleToolInvoke(toolName: string, params: Record<string, unknown>): Promise<WeatherResponse> {
    if (toolName !== 'get_weather') {
      return { error: `Unknown tool: ${toolName}` };
    }

    const location = params.location;
    if (!location || typeof location !== 'string') {
      return { error: 'Missing required parameter: location' };
    }

    return getMockWeather(location);
  }
}
