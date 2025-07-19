# Kahoot MongoDB App

A serverless quiz application built with Adobe I/O Runtime and MongoDB Atlas. This application provides REST APIs to create games, add questions, and retrieve game data for a Kahoot-style quiz platform.

## 🏗️ Architecture

- **Runtime**: Adobe I/O Runtime (Apache OpenWhisk)
- **Database**: MongoDB Atlas
- **Language**: Node.js 22
- **Framework**: Adobe I/O SDK

## 🚀 Available Actions

This app provides three main serverless actions:

### 1. Add Game (`addGame`)

Creates a new quiz game with a name.

**Endpoint**: `POST /addGame`

**Request Body**:
```json
{
  "name": "My Quiz Game"
}
```

**Response**:
```json
{
  "statusCode": 200,
  "body": {
    "acknowledged": true,
    "insertedId": "generated_game_id"
  }
}
```

**Error Cases**:
- Game with the same name already exists

---

### 2. Add Questions (`addQuestion`)

Creates or updates a game with questions. This action can create a new game or update an existing one with the complete game data including questions.

**Endpoint**: `POST /addQuestion`

**Request Body**:
```json
{
  "_id": "game_123",
  "name": "My Quiz Game",
  "questions": [
    {
      "questionId": "q1",
      "questionType": "single-choice",
      "questionText": "What is the capital of France?",
      "options": ["Paris", "London", "Berlin", "Madrid"],
      "correctAnswer": "Paris",
      "timeLimit": 30,
      "createdAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "questionId": "q2",
      "questionType": "single-choice", 
      "questionText": "What is 2+2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": "4",
      "timeLimit": 20,
      "createdAt": "2024-01-01T10:01:00.000Z"
    }
  ],
  "updatedAt": "2024-01-01T10:01:00.000Z"
}
```

**Response**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "success": true,
    "message": "Successfully updated game game_123 with 2 question(s)",
    "gameId": "game_123",
    "questionsCount": 2,
    "questionIds": ["q1", "q2"],
    "operation": "created"
  }
}
```

**Validation Rules**:
- Each question must have: `questionId`, `questionType`, `questionText`, `options`, `correctAnswer`
- `options` must be an array
- For single-choice questions, `correctAnswer` must be one of the provided options
- Question IDs must be unique within the game

---

### 3. Get Game by ID (`getGameByID`)

Retrieves a complete game document including all questions by game ID.

**Endpoint**: `GET /getGameByID`

**Request Body**:
```json
{
  "id": "game_123"
}
```

**Success Response (200)**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"success\": true, \"game\": {\"_id\": \"game_123\", \"name\": \"My Quiz Game\", \"questions\": [...], \"createdAt\": \"...\", \"updatedAt\": \"...\"}}"
}
```

**Not Found Response (404)**:
```json
{
  "statusCode": 404,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"success\": false, \"message\": \"Game not found\"}"
}
```

---

## 🛠️ Setup and Deployment

### Prerequisites

- Node.js 18+
- Adobe I/O CLI
- MongoDB Atlas account and connection string

### Installation

1. Clone the repository:
```bash
git clone https://github.com/preetishb/kahootIO.git
cd kahootIO
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Set your MongoDB Atlas URI
export ATLAS_URI="mongodb+srv://username:password@cluster.mongodb.net/"
```

### Deployment

1. Deploy to Adobe I/O Runtime:
```bash
aio app deploy
```

2. The actions will be available at:
- `https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/addGame`
- `https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/addQuestion`
- `https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/getGameByID`

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run e2e
```

### Linting
```bash
npm run lint
npm run lint:fix
```

---

## 📋 API Usage Examples

### Using cURL

**Create a game:**
```bash
curl -X POST https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/addGame \
  -H "Content-Type: application/json" \
  -d '{"name": "Geography Quiz"}'
```

**Add questions to game:**
```bash
curl -X POST https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/addQuestion \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "geography_001",
    "name": "Geography Quiz",
    "questions": [
      {
        "questionId": "geo_q1",
        "questionType": "single-choice",
        "questionText": "What is the capital of Japan?",
        "options": ["Tokyo", "Kyoto", "Osaka", "Hiroshima"],
        "correctAnswer": "Tokyo",
        "timeLimit": 30
      }
    ]
  }'
```

**Get a game:**
```bash
curl -X GET https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/getGameByID \
  -H "Content-Type: application/json" \
  -d '{"id": "geography_001"}'
```

### Using JavaScript/Fetch

```javascript
// Add questions to a game
const response = await fetch('https://[namespace].adobeioruntime.net/api/v1/web/KahootMongoApp/addQuestion', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "_id": "quiz_001",
    "name": "Science Quiz",
    "questions": [
      {
        "questionId": "sci_q1",
        "questionType": "single-choice",
        "questionText": "What is the chemical symbol for water?",
        "options": ["H2O", "CO2", "NaCl", "O2"],
        "correctAnswer": "H2O",
        "timeLimit": 20
      }
    ]
  })
});

const result = await response.json();
console.log(result);
```

---

## 🗃️ Database Structure

### Game Collection (`gameCollection`)

```javascript
{
  "_id": "unique_game_id",
  "name": "Game Name",
  "questions": [
    {
      "questionId": "unique_question_id",
      "questionType": "single-choice",
      "questionText": "Question text here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1",
      "timeLimit": 30,
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "createdAt": "2024-01-01T09:00:00.000Z",
  "updatedAt": "2024-01-01T10:00:00.000Z"
}
```

---

## 🔧 Configuration

The app configuration is defined in `app.config.yaml`:

- All actions are web-enabled (`web: 'yes'`)
- No authentication required (`require-adobe-auth: false`)
- Runtime: Node.js 22
- Environment variables: `ATLAS_URI`, `LOG_LEVEL`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

## 📄 License

This project is licensed under the Apache-2.0 License.

---

## 🔗 Links

- [Adobe I/O Runtime Documentation](https://developer.adobe.com/runtime/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Repository](https://github.com/preetishb/kahootIO)
