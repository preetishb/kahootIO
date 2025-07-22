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
      parsedParams.status,
      parsedParams.startDate,
      parsedParams.endDate,
      parsedParams.questions,
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

async function run(_id, title, description, tags, status, startDate, endDate, questions, client) {
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

    // Handle questions validation if provided
    let validatedQuestions = [];
    if (questions !== undefined && questions !== null) {
      if (!Array.isArray(questions)) {
        throw new Error('Questions must be an array');
      }

      // Validate questions structure
      for (const question of questions) {
        if (!question.questionId || !question.questionType || !question.questionText || !question.options || !question.correctAnswer) {
          throw new Error('Each question must have questionId, questionType, questionText, options, and correctAnswer');
        }
        
        if (!Array.isArray(question.options)) {
          throw new Error('Options must be an array');
        }
        
        // Validate timeLimit if provided
        if (question.timeLimit !== undefined && question.timeLimit !== null) {
          const timeLimitNum = Number(question.timeLimit);
          if (isNaN(timeLimitNum) || timeLimitNum <= 0) {
            throw new Error(`Question "${question.questionId}" has invalid timeLimit. Time limit must be a positive number (in seconds)`);
          }
        }
        
        // Validate correctAnswer based on question type
        if (question.questionType === 'single-choice') {
          // For single-choice, correctAnswer should be an integer (index)
          if (!Number.isInteger(question.correctAnswer)) {
            throw new Error(`For single-choice questions, correctAnswer must be an integer index, got: ${typeof question.correctAnswer}`);
          }
          if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
            throw new Error(`Correct answer index ${question.correctAnswer} is out of range. Must be between 0 and ${question.options.length - 1}`);
          }
        } else if (question.questionType === 'multiple-choice') {
          // For multiple-choice, correctAnswer should be an array of integers
          if (!Array.isArray(question.correctAnswer)) {
            throw new Error(`For multiple-choice questions, correctAnswer must be an array of integers, got: ${typeof question.correctAnswer}`);
          }
          if (question.correctAnswer.length === 0) {
            throw new Error('Multiple-choice questions must have at least one correct answer');
          }
          // Check that all correct answer indices are valid
          for (const correctIndex of question.correctAnswer) {
            if (!Number.isInteger(correctIndex)) {
              throw new Error(`All correct answer indices must be integers, got: ${typeof correctIndex}`);
            }
            if (correctIndex < 0 || correctIndex >= question.options.length) {
              throw new Error(`Correct answer index ${correctIndex} is out of range. Must be between 0 and ${question.options.length - 1}`);
            }
          }
          // Check for duplicate indices
          const uniqueIndices = [...new Set(question.correctAnswer)];
          if (uniqueIndices.length !== question.correctAnswer.length) {
            throw new Error('Correct answer indices cannot contain duplicates');
          }
        } else {
          // For other question types, accept both integer and array of integers
          if (Number.isInteger(question.correctAnswer)) {
            if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
              throw new Error(`Correct answer index ${question.correctAnswer} is out of range. Must be between 0 and ${question.options.length - 1}`);
            }
          } else if (Array.isArray(question.correctAnswer)) {
            if (question.correctAnswer.length === 0) {
              throw new Error('Question must have at least one correct answer');
            }
            for (const correctIndex of question.correctAnswer) {
              if (!Number.isInteger(correctIndex)) {
                throw new Error(`All correct answer indices must be integers, got: ${typeof correctIndex}`);
              }
              if (correctIndex < 0 || correctIndex >= question.options.length) {
                throw new Error(`Correct answer index ${correctIndex} is out of range. Must be between 0 and ${question.options.length - 1}`);
              }
            }
            // Check for duplicate indices
            const uniqueIndices = [...new Set(question.correctAnswer)];
            if (uniqueIndices.length !== question.correctAnswer.length) {
              throw new Error('Correct answer indices cannot contain duplicates');
            }
          } else {
            throw new Error(`correctAnswer must be either an integer or an array of integers, got: ${typeof question.correctAnswer}`);
          }
        }
      }

      validatedQuestions = questions;
    }

    // Add a record to the "games" collection
    const doc = {
      _id: gameId,
      title: title,
      description: description,
      tags: parsedTags,
      status: status,
      startDate: startDateObj,
      endDate: endDateObj,
      questions: validatedQuestions,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(doc);
    
    // Prepare response with question information if questions were provided
    const response = {
      success: true,
      message: "Game created successfully",
      _id: gameId,
      insertedId: result.insertedId,
      game: doc
    };

    // Add questions-specific information if questions were provided
    if (questions !== undefined && questions !== null && questions.length > 0) {
      response.questionsCount = questions.length;
      response.questionIds = questions.map(q => q.questionId);
    }
    
    return response;
  } catch (error) {
    console.error("Error in run function:", error);
    throw error;
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
