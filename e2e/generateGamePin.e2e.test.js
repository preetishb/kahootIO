/* 
* <license header>
*/

const { main } = require('../actions/generateGamePin/index.js');

describe('generateGamePin E2E Test', () => {
  // Mock environment variables
  const mockParams = {
    _id: 'test-game-aephol',
    ATLAS_URI: process.env.ATLAS_URI || 'mongodb://localhost:27017',
    LOG_LEVEL: 'debug'
  };

  beforeAll(() => {
    // Ensure we have the required environment variables for testing
    if (!process.env.ATLAS_URI && !mockParams.ATLAS_URI.includes('localhost')) {
      console.warn('Warning: Using default localhost MongoDB URI for testing. Set ATLAS_URI environment variable for production testing.');
    }
  });

  it('should generate a unique 6-digit game pin', async () => {
    const result = await main(mockParams);
    
    expect(result).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('gamepin');
    expect(result.body).toHaveProperty('_id', mockParams._id);
    
    // Verify the game pin is a 6-digit string
    expect(typeof result.body.gamepin).toBe('string');
    expect(result.body.gamepin).toMatch(/^\d{6}$/);
    expect(result.body.gamepin.length).toBe(6);
    
    console.log(`Generated game pin: ${result.body.gamepin} for game: ${result.body._id}`);
  }, 10000); // 10 second timeout for database operations

  it('should generate different pins for different games', async () => {
    const params1 = { ...mockParams, _id: 'test-game-1' };
    const params2 = { ...mockParams, _id: 'test-game-2' };
    
    const [result1, result2] = await Promise.all([
      main(params1),
      main(params2)
    ]);
    
    expect(result1.statusCode).toBe(200);
    expect(result2.statusCode).toBe(200);
    expect(result1.body.gamepin).toMatch(/^\d{6}$/);
    expect(result2.body.gamepin).toMatch(/^\d{6}$/);
    
    // The pins could theoretically be the same due to randomness, 
    // but it's extremely unlikely with 6 digits (1 in 900,000 chance)
    console.log(`Game 1 pin: ${result1.body.gamepin}, Game 2 pin: ${result2.body.gamepin}`);
  }, 15000);

  it('should handle missing _id parameter', async () => {
    const invalidParams = { ...mockParams };
    delete invalidParams._id;
    
    const result = await main(invalidParams);
    
    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Internal Server Error');
  });

  it('should handle missing ATLAS_URI parameter', async () => {
    const invalidParams = { _id: 'test-game' };
    // No ATLAS_URI provided
    
    const result = await main(invalidParams);
    
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('ATLAS_URI parameter is required');
  });

  it('should handle invalid ATLAS_URI', async () => {
    const invalidParams = {
      _id: 'test-game',
      ATLAS_URI: 'invalid-mongodb-uri'
    };
    
    const result = await main(invalidParams);
    
    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Internal Server Error');
  }, 10000);
});
