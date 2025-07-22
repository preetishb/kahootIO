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
      if (!question.questionId || !question.questionType || !question.questionText || !question.options) {
        throw new Error('Each question must have questionId, questionType, questionText, and options');
      }
      
      if (!Array.isArray(question.options)) {
        throw new Error('Options must be an array');
      }

      // Validate correctAnswers (required)
      if (!question.correctAnswers) {
        throw new Error('Each question must have correctAnswers');
      }

      if (!Array.isArray(question.correctAnswers)) {
        throw new Error(`correctAnswers must be an array for question ${question.questionId}`);
      }

      if (question.correctAnswers.length === 0) {
        throw new Error(`correctAnswers cannot be empty for question ${question.questionId}`);
      }

      for (const answerIndex of question.correctAnswers) {
        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) {
          throw new Error(`Invalid correctAnswers index ${answerIndex} for question ${question.questionId}`);
        }
      }

      // Validate timeLimit if provided
      if (question.timeLimit !== undefined && question.timeLimit !== null) {
        if (!Number.isInteger(question.timeLimit) || question.timeLimit <= 0) {
          throw new Error(`timeLimit must be a positive integer for question ${question.questionId}`);
        }
      }
    }

    // Check if game exists, if not create it
    let existingGame = await gameCollection.findOne({ _id: params._id });
    
    if (!existingGame) {
      // Create new game
      existingGame = {
        _id: params._id,
        name: params.name || `Game ${params._id}`,
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // Get existing questions or initialize empty array
    const existingQuestions = existingGame.questions || [];
    
    // Track operations for response
    let addedQuestions = [];
    let updatedQuestions = [];
    
    // Process each incoming question
    let updatedQuestionsArray = [...existingQuestions];
    
    for (const incomingQuestion of params.questions) {
      const existingQuestionIndex = updatedQuestionsArray.findIndex(
        q => q.questionId === incomingQuestion.questionId
      );
      
      // Add timestamps to question
      const questionToSave = {
        ...incomingQuestion,
        updatedAt: new Date()
      };
      
      if (existingQuestionIndex !== -1) {
        // Update existing question
        questionToSave.createdAt = updatedQuestionsArray[existingQuestionIndex].createdAt || new Date();
        updatedQuestionsArray[existingQuestionIndex] = questionToSave;
        updatedQuestions.push(incomingQuestion.questionId);
      } else {
        // Add new question
        questionToSave.createdAt = new Date();
        updatedQuestionsArray.push(questionToSave);
        addedQuestions.push(incomingQuestion.questionId);
      }
    }

    // Update the game document
    const result = await gameCollection.updateOne(
      { _id: params._id },
      { 
        $set: { 
          questions: updatedQuestionsArray,
          updatedAt: new Date(),
          ...(params.name && { name: params.name })
        }
      },
      { upsert: true }
    );

    logger.info(`Game ${params._id} updated. Added: ${addedQuestions.length}, Updated: ${updatedQuestions.length} questions`);

    return {
      success: true,
      message: `Successfully processed ${params.questions.length} question(s) for game ${params._id}`,
      gameId: params._id,
      totalQuestions: updatedQuestionsArray.length,
      addedQuestions: addedQuestions,
      updatedQuestions: updatedQuestions,
      addedCount: addedQuestions.length,
      updatedCount: updatedQuestions.length,
      operation: result.upsertedCount > 0 ? 'game_created' : 'game_updated'
    };

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
