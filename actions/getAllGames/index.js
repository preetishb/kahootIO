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
    logger.info("Calling the main action in get all games");

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params));

    // No need to parse parameters since we don't take any user input
    const content = await run(client).catch(console.dir);

    return content;
  } catch (error) {
    // log any server errors
    logger.error(error);
  }
}

async function run(client) {
  try {
    console.log("inside get all games");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    const database = client.db("gameDb");
    const collection = database.collection("gameCollection");

    // Get all games from the collection
    const allGames = await collection.find({}).toArray();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        games: allGames,
        count: allGames.length
      })
    };

  } catch (error) {
    console.error("Error fetching games:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        message: "Error fetching games",
        error: error.message
      })
    };
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
