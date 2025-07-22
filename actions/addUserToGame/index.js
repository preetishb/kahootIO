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
    logger.info("Calling the main action to add user to game");

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params));

    // Parse the JSON string back into an object
    const parsedParams = JSON.parse(stringParameters(params));
    const content = await run(
      parsedParams._id,
      parsedParams.user,
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

async function run(_id, user, client) {
  try {
    console.log("inside add user to game");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    const database = client.db("gameDb");
    const collection = database.collection("gameCollection");

    // Validate required _id parameter
    if (!_id) {
      throw new Error("Game ID is required for adding user to game");
    }

    // Check if the game exists
    const existingGame = await collection.findOne({ _id: _id });
    if (!existingGame) {
      throw new Error("Game with this ID does not exist");
    }

    // Validate user object
    if (!user || typeof user !== 'object') {
      throw new Error("User must be provided as an object");
    }

    if (!user.userName) {
      throw new Error("User must have a userName");
    }
    
    // Validate score if provided (should be numeric)
    if (user.score !== undefined && user.score !== null) {
      const scoreNum = Number(user.score);
      if (isNaN(scoreNum) || scoreNum < 0) {
        throw new Error(`Invalid score for user ${user.userName}. Score must be a non-negative number`);
      }
    }
    
    // Validate rank if provided (should be numeric)
    if (user.rank !== undefined && user.rank !== null) {
      const rankNum = Number(user.rank);
      if (isNaN(rankNum) || rankNum < 1) {
        throw new Error(`Invalid rank for user ${user.userName}. Rank must be a positive number`);
      }
    }

    // Validate avatar if provided (should be a string)
    if (user.avatar !== undefined && user.avatar !== null) {
      if (typeof user.avatar !== 'string') {
        throw new Error(`Invalid avatar for user ${user.userName}. Avatar must be a string`);
      }
      if (user.avatar.trim().length === 0) {
        throw new Error(`Invalid avatar for user ${user.userName}. Avatar cannot be an empty string`);
      }
    }

    // Get existing users or initialize empty array
    const existingUsers = existingGame.users || [];
    
    // Check if user already exists
    const existingUserIndex = existingUsers.findIndex(existingUser => existingUser.userName === user.userName);
    
    let updatedUsers = [...existingUsers];
    let isNewUser = false;
    let isUpdated = false;

    if (existingUserIndex !== -1) {
      // Update existing user
      updatedUsers[existingUserIndex] = {
        ...updatedUsers[existingUserIndex],
        ...user, // New user data overwrites existing
        updatedAt: new Date()
      };
      isUpdated = true;
    } else {
      // Add new user
      const userToAdd = {
        ...user,
        addedAt: new Date()
      };
      updatedUsers.push(userToAdd);
      isNewUser = true;
    }

    // Update the game document
    const result = await collection.updateOne(
      { _id: _id },
      { 
        $set: { 
          users: updatedUsers,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Game not found");
    }

    // Get the updated game document
    const updatedGame = await collection.findOne({ _id: _id });
    
    const message = isNewUser ? 
      `User '${user.userName}' successfully added to game` : 
      `User '${user.userName}' successfully updated in game`;
    
    return {
      success: true,
      message: message,
      _id: _id,
      modifiedCount: result.modifiedCount,
      totalUsers: updatedUsers.length,
      isNewUser: isNewUser,
      isUpdated: isUpdated,
      userName: user.userName,
      game: updatedGame
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
