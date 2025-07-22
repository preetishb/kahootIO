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
    logger.info("Calling the main action to update game");

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
    console.log("inside update game");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    const database = client.db("gameDb");
    const collection = database.collection("gameCollection");

    // Validate required _id parameter
    if (!_id) {
      throw new Error("Game ID is required for updating a game");
    }

    // Check if the game exists
    const existingGame = await collection.findOne({ _id: _id });
    if (!existingGame) {
      throw new Error("Game with this ID does not exist");
    }

    // Prepare update object with only provided fields
    const updateDoc = {
      updatedAt: new Date()
    };

    // Only update fields that are provided
    if (title !== undefined && title !== null) {
      updateDoc.title = title;
    }
    
    if (description !== undefined && description !== null) {
      updateDoc.description = description;
    }

    if (tags !== undefined && tags !== null) {
      // Handle tags as array
      let parsedTags = [];
      if (Array.isArray(tags)) {
        parsedTags = tags.filter(tag => tag && tag.trim().length > 0);
      } else if (typeof tags === 'string') {
        // Fallback: handle single tag as string
        parsedTags = [tags.trim()];
      }
      updateDoc.tags = parsedTags;
    }

    if (status !== undefined && status !== null) {
      updateDoc.status = status;
    }

    // Handle questions updates with validation (similar to addQuestion action)
    let addedQuestions = [];
    let updatedQuestions = [];
    
    if (questions !== undefined && questions !== null) {
      if (!Array.isArray(questions)) {
        throw new Error('Questions must be an array');
      }

      // Validate questions structure
      for (const question of questions) {
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

      // Get existing questions or initialize empty array
      const existingQuestions = existingGame.questions || [];
      
      // Process each incoming question
      let updatedQuestionsArray = [...existingQuestions];
      
      for (const incomingQuestion of questions) {
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

      updateDoc.questions = updatedQuestionsArray;
    }

    // Handle date updates with validation
    if (startDate !== undefined && startDate !== null) {
      const startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        throw new Error("Invalid start date format. Please use a valid date format.");
      }
      updateDoc.startDate = startDateObj;
    }

    if (endDate !== undefined && endDate !== null) {
      const endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        throw new Error("Invalid end date format. Please use a valid date format.");
      }
      updateDoc.endDate = endDateObj;
    }

    // Validate that start date is before end date (if both are being updated)
    if (updateDoc.startDate && updateDoc.endDate) {
      if (updateDoc.startDate >= updateDoc.endDate) {
        throw new Error("Start date must be before end date");
      }
    } else if (updateDoc.startDate && existingGame.endDate) {
      if (updateDoc.startDate >= existingGame.endDate) {
        throw new Error("Start date must be before existing end date");
      }
    } else if (updateDoc.endDate && existingGame.startDate) {
      if (existingGame.startDate >= updateDoc.endDate) {
        throw new Error("Existing start date must be before new end date");
      }
    }

    // Update the game document
    const result = await collection.updateOne(
      { _id: _id },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      throw new Error("Game not found");
    }

    // Get the updated game document
    const updatedGame = await collection.findOne({ _id: _id });
    
    // Prepare response with question information if questions were updated
    const response = {
      success: true,
      message: "Game updated successfully",
      _id: _id,
      modifiedCount: result.modifiedCount,
      game: updatedGame
    };

    // Add questions-specific information if questions were updated
    if (questions !== undefined && questions !== null) {
      response.totalQuestions = updatedGame.questions ? updatedGame.questions.length : 0;
      response.addedQuestions = addedQuestions;
      response.updatedQuestions = updatedQuestions;
      response.addedCount = addedQuestions.length;
      response.updatedCount = updatedQuestions.length;
      response.processedQuestions = questions.length;
    }
    
    return response;
  } catch (error) {
    console.error("Error in run function :", error);
    throw error;
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

exports.main = main;
