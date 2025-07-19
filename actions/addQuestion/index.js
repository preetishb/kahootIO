/*
 * <license header>
 */

/**
 * This action adds questions to a game in MongoDB
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
    logger.info("Calling the main action to add questions");

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
    logger.info("Inside add questions function");
    
    // Connect the client to the server
    await client.connect();
    const database = client.db("gameDb");
    const gameCollection = database.collection("gameCollection");

    // Validate that we have the required game data
    if (!params._id) {
      throw new Error('Game _id is required');
    }

    if (!params.questions || !Array.isArray(params.questions)) {
      throw new Error('Questions array is required');
    }

    // Validate questions structure
    for (const question of params.questions) {
      if (!question.questionId || !question.questionType || !question.questionText || !question.options || !question.correctAnswer) {
        throw new Error('Each question must have questionId, questionType, questionText, options, and correctAnswer');
      }
      
      if (!Array.isArray(question.options)) {
        throw new Error('Options must be an array');
      }
      
      if (question.questionType === 'single-choice' && !question.options.includes(question.correctAnswer)) {
        throw new Error(`Correct answer "${question.correctAnswer}" must be one of the provided options`);
      }
    }

    // Prepare the game document for upsert
    const gameDocument = {
      _id: params._id,
      name: params.name,
      questions: params.questions,
      updatedAt: new Date()
    };

    // If createdAt is not provided, add it for new documents
    if (!params.createdAt) {
      gameDocument.createdAt = new Date();
    }

    // Use upsert to either update existing game or create new one
    const result = await gameCollection.replaceOne(
      { _id: params._id },
      gameDocument,
      { upsert: true }
    );

    logger.info(`Game ${params._id} updated with ${params.questions.length} questions`);

    return {
      success: true,
      message: `Successfully updated game ${params._id} with ${params.questions.length} question(s)`,
      gameId: params._id,
      questionsCount: params.questions.length,
      questionIds: params.questions.map(q => q.questionId),
      operation: result.upsertedCount > 0 ? 'created' : 'updated'
    };

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
