/*
 * <license header>
 */

const { main } = require('../actions/generateGamePin/index.js');

describe('generateGamePin action', () => {
  let mockClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    // Mock MongoDB collection methods
    mockCollection = {
      find: jest.fn(),
    };

    // Mock MongoDB database
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    // Mock MongoDB client
    mockClient = {
      connect: jest.fn(),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn(),
    };
  });

  it('should generate a unique 6-digit game pin successfully', async () => {
    // Mock existing games with some pins
    const existingGames = [
      { _id: 'game1', gamePin: '123456' },
      { _id: 'game2', gamePin: '234567' },
      { _id: 'game3', gamePin: '345678' }
    ];

    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue(existingGames)
    });

    const params = {
      _id: 'aephol',
      ATLAS_URI: 'mongodb://test-uri'
    };

    // Mock the MongoClient constructor
    const originalMongoClient = require('mongodb').MongoClient;
    require('mongodb').MongoClient = jest.fn().mockImplementation(() => mockClient);

    const result = await main(params);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('gamepin');
    expect(result.body).toHaveProperty('_id', 'aephol');
    expect(result.body.gamepin).toMatch(/^\d{6}$/); // Should be 6 digits
    expect(['123456', '234567', '345678']).not.toContain(result.body.gamepin); // Should be unique

    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.close).toHaveBeenCalled();
    expect(mockDb.collection).toHaveBeenCalledWith('gameCollection');
    expect(mockCollection.find).toHaveBeenCalledWith({});

    // Restore original MongoClient
    require('mongodb').MongoClient = originalMongoClient;
  });

  it('should handle case with no existing games', async () => {
    // Mock empty games collection
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([])
    });

    const params = {
      _id: 'aephol',
      ATLAS_URI: 'mongodb://test-uri'
    };

    // Mock the MongoClient constructor
    const originalMongoClient = require('mongodb').MongoClient;
    require('mongodb').MongoClient = jest.fn().mockImplementation(() => mockClient);

    const result = await main(params);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('gamepin');
    expect(result.body).toHaveProperty('_id', 'aephol');
    expect(result.body.gamepin).toMatch(/^\d{6}$/); // Should be 6 digits

    // Restore original MongoClient
    require('mongodb').MongoClient = originalMongoClient;
  });

  it('should handle games without gamePin field', async () => {
    // Mock games without gamePin field
    const existingGames = [
      { _id: 'game1', title: 'Game 1' },
      { _id: 'game2', title: 'Game 2', gamePin: '123456' },
      { _id: 'game3', title: 'Game 3' }
    ];

    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue(existingGames)
    });

    const params = {
      _id: 'aephol',
      ATLAS_URI: 'mongodb://test-uri'
    };

    // Mock the MongoClient constructor
    const originalMongoClient = require('mongodb').MongoClient;
    require('mongodb').MongoClient = jest.fn().mockImplementation(() => mockClient);

    const result = await main(params);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('gamepin');
    expect(result.body.gamepin).toMatch(/^\d{6}$/);
    expect(result.body.gamepin).not.toBe('123456'); // Should not use existing pin

    // Restore original MongoClient
    require('mongodb').MongoClient = originalMongoClient;
  });

  it('should return error when _id is missing', async () => {
    const params = {
      ATLAS_URI: 'mongodb://test-uri'
      // Missing _id
    };

    // Mock the MongoClient constructor
    const originalMongoClient = require('mongodb').MongoClient;
    require('mongodb').MongoClient = jest.fn().mockImplementation(() => mockClient);

    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Internal Server Error');

    // Restore original MongoClient
    require('mongodb').MongoClient = originalMongoClient;
  });

  it('should return error when ATLAS_URI is missing', async () => {
    const params = {
      _id: 'aephol'
      // Missing ATLAS_URI
    };

    const result = await main(params);

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('ATLAS_URI parameter is required');
  });

  it('should handle database connection errors', async () => {
    mockClient.connect.mockRejectedValue(new Error('Connection failed'));

    const params = {
      _id: 'aephol',
      ATLAS_URI: 'mongodb://test-uri'
    };

    // Mock the MongoClient constructor
    const originalMongoClient = require('mongodb').MongoClient;
    require('mongodb').MongoClient = jest.fn().mockImplementation(() => mockClient);

    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Internal Server Error');

    // Restore original MongoClient
    require('mongodb').MongoClient = originalMongoClient;
  });
});
