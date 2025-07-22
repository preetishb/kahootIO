/*
 * <license header>
 */

/**
 * This action generates a unique 6-digit game pin
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */

const { Core } = require("@adobe/aio-sdk");
const {
  stringParameters,
  errorResponse
} = require("../utils");
const { MongoClient, ServerApiVersion } = require("mongodb");

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger("main", { level: params.LOG_LEVEL || "info" });

  try {
    // 'info' is the default level if not set
    logger.info("Calling the main action to generate game pin");

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params));

    const uri = params.ATLAS_URI;
    if (!uri) {
      return errorResponse(400, 'ATLAS_URI parameter is required', logger);
    }

    // Create a MongoClient with a MongoClientOptions object to set the Stable API version
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    const content = await run(params, client, logger).catch((error) => {
      logger.error('Error in run function:', error);
      throw error;
    });

    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: content,
    };

    return response;
  } catch (error) {
    // log any server errors
    logger.error(error);
    return errorResponse(500, 'Internal Server Error', logger);
  }
}

async function run(params, client, logger) {
  try {
    logger.info("Inside generate game pin function");
    
    // Connect the client to the server
    await client.connect();
    const database = client.db("gameDb");
    const gameCollection = database.collection("gameCollection");

    // Validate that we have the required _id
    if (!params._id) {
      throw new Error('Game _id is required');
    }

    // Check if this specific game already has a pin
    const currentGame = await gameCollection.findOne({ _id: params._id });
    if (currentGame && currentGame.gamePin) {
      logger.info(`Game ${params._id} already has pin: ${currentGame.gamePin}`);
      return {
        gamepin: currentGame.gamePin,
        _id: params._id
      };
    }

    // Step 1: Get all games array
    const allGames = await gameCollection.find({}).toArray();
    logger.info(`Found ${allGames.length} games in database`);

    // Step 2: Create array of existing pins
    const existingPins = [];
    for (const game of allGames) {
      if (game.gamePin && typeof game.gamePin === 'string') {
        existingPins.push(game.gamePin);
      }
    }
    
    logger.info(`Found ${existingPins.length} existing game pins`);

    // Step 3: Generate a unique 6-digit random number
    let gamePin = generateUniquePin(existingPins);
    
    // Extra safety check - if somehow we couldn't generate a unique pin after many attempts
    let attempts = 0;
    const maxAttempts = 1000;
    while (existingPins.includes(gamePin) && attempts < maxAttempts) {
      gamePin = generateUniquePin(existingPins);
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique pin after maximum attempts');
    }

    logger.info(`Generated unique game pin: ${gamePin} for game ${params._id}`);

    // Update the game with the generated pin
    await gameCollection.updateOne(
      { _id: params._id },
      { 
        $set: { 
          gamePin: gamePin,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    logger.info(`Game ${params._id} updated with pin ${gamePin}`);

    // Return the response in the specified format
    return {
      gamepin: gamePin,
      _id: params._id
    };

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

// Helper function to generate a unique 6-digit pin
function generateUniquePin(existingPins) {
  let pin;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    // Generate a 6-digit random number (100000 to 999999)
    pin = Math.floor(Math.random() * 900000) + 100000;
    pin = pin.toString();
    attempts++;
  } while (existingPins.includes(pin) && attempts < maxAttempts);
  
  return pin;
}

exports.main = main;
