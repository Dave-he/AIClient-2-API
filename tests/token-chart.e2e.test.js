import { describe, it, expect } from '@jest/globals';
import { fetch } from 'undici';

const TEST_SERVER_BASE_URL = 'http://localhost:3000';

describe('Token Usage Chart End-to-End Test', () => {
  describe('/api/model-usage-stats', () => {
    it('should return stats data with hourly and daily fields', async () => {
      const response = await fetch(`${TEST_SERVER_BASE_URL}/api/model-usage-stats`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      
      const stats = data.data;
      
      expect(stats.summary).toBeDefined();
      expect(stats.providers).toBeDefined();
      expect(stats.daily).toBeDefined();
      expect(stats.hourly).toBeDefined();
      
      expect(typeof stats.summary).toBe('object');
      expect(typeof stats.daily).toBe('object');
      expect(typeof stats.hourly).toBe('object');
    });

    it('should have correct structure for hourly data', async () => {
      const response = await fetch(`${TEST_SERVER_BASE_URL}/api/model-usage-stats`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      const data = await response.json();
      const stats = data.data;
      
      if (Object.keys(stats.hourly).length > 0) {
        const firstKey = Object.keys(stats.hourly)[0];
        const hourlyEntry = stats.hourly[firstKey];
        
        expect(hourlyEntry.requestCount).toBeDefined();
        expect(hourlyEntry.promptTokens).toBeDefined();
        expect(hourlyEntry.completionTokens).toBeDefined();
        expect(hourlyEntry.totalTokens).toBeDefined();
        expect(hourlyEntry.cachedTokens).toBeDefined();
      }
    });

    it('should have correct structure for daily data', async () => {
      const response = await fetch(`${TEST_SERVER_BASE_URL}/api/model-usage-stats`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      const data = await response.json();
      const stats = data.data;
      
      if (Object.keys(stats.daily).length > 0) {
        const firstKey = Object.keys(stats.daily)[0];
        const dailyEntry = stats.daily[firstKey];
        
        expect(dailyEntry.requestCount).toBeDefined();
        expect(dailyEntry.promptTokens).toBeDefined();
        expect(dailyEntry.completionTokens).toBeDefined();
        expect(dailyEntry.totalTokens).toBeDefined();
        expect(dailyEntry.cachedTokens).toBeDefined();
      }
    });

    it('should handle empty stats gracefully', async () => {
      const response = await fetch(`${TEST_SERVER_BASE_URL}/api/model-usage-stats`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      const data = await response.json();
      const stats = data.data;
      
      expect(stats.summary.requestCount).toBeDefined();
      expect(typeof stats.summary.requestCount).toBe('number');
    });
  });
});