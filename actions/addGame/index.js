/*
 * <license header>
 */

/**
 * This is a sample action showcasing how to access an external API
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
  stringParameters
} = require("../utils");
const { MongoClient, ServerApiVersion } = require("mongodb");
//require('dotenv').config();
//const passwordAtlas = process.env.PASSWORD_ATLAS;

// Function to generate unique game ID
function generateGameId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `game_${timestamp}${randomStr}`;
}

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger("main", { level: params.LOG_LEVEL || "info" });

  const uri = params.ATLAS_URI;

  // Create a MongoClient with a MongoClientOptions object to set the Stable API version
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  
  try {
    // 'info' is the default level if not set
    logger.info("Calling the main action in add game");

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params));

    

    // Parse the JSON string back into an object
    const parsedParams = JSON.parse(stringParameters(params));
    const content = await run(
      parsedParams._id,
      parsedParams.title,
      parsedParams.description,
      parsedParams.tags,
      parsedParams.publishStatus,
      parsedParams.startDate,
      parsedParams.endDate,
      client
    ).catch(console.dir);
    
    const response = {
      statusCode: 200,
      body: content,
    };

    return response;
  } catch (error) {
    // log any server errors
    logger.error(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}

async function run(_id, title, description, tags, publishStatus, startDate, endDate, client) {
  try {
    console.log("inside add game");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    const database = client.db("gameDb");
    const collection = database.collection("gameCollection");

    // Use provided _id or generate unique game ID
    const gameId = _id || generateGameId();

    // Check if the _id already exists
    const existingGame = await collection.findOne({ _id: gameId });
    if (existingGame) {
      throw new Error("Game with this ID already exists");
    }

    // Check if the title already exists (optional additional check)
    const existingTitle = await collection.findOne({ title: title });
    if (existingTitle) {
      throw new Error("Game with this title already exists");
    }

    // Handle tags as array
    let parsedTags = [];
    if (tags && Array.isArray(tags)) {
      parsedTags = tags.filter(tag => tag && tag.trim().length > 0);
    } else if (tags && typeof tags === 'string') {
      // Fallback: handle single tag as string
      parsedTags = [tags.trim()];
    }

    // Validate date format and convert to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error("Invalid date format. Please use a valid date format.");
    }
    
    if (startDateObj >= endDateObj) {
      throw new Error("Start date must be before end date");
    }

    // Add a record to the "games" collection
    const doc = {
      _id: gameId,
      title: title,
      description: description,
      tags: parsedTags,
      publishStatus: publishStatus === true || publishStatus === 'true',
      startDate: startDateObj,
      endDate: endDateObj,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(doc);
    
    return {
      success: true,
      message: "Game created successfully",
      _id: gameId,
      insertedId: result.insertedId,
      game: doc
    };
  } catch (error) {
    console.error("Error in run function:", error);
    throw error;
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
