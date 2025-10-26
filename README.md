# ReachInbox OneBox

Developer copy of the ReachInbox backend + frontend used for the OneBox project.

Quick start (backend)

Prerequisites:
- Node.js (18+ recommended)
- npm

Run backend in mock mode (no Elasticsearch):

PowerShell:

```powershell
$env:ES_URL="mock://development"
npm run build
npm start
```

This starts the Express server on port 3000 by default. Available endpoints:
- GET /health
- GET /api/emails/search?q=<query>
- GET /api/emails

Frontend (development)

```powershell
cd web
npm install
npm run dev
```

Notes
- A mock search implementation is used when `ES_URL` starts with `mock://`.
- Avoid committing secrets — store them in `.env` which is ignored.

Contributing
- Feel free to open issues or PRs. This repo contains a small CI workflow that runs `npm ci` and `npm run build` on push.

License: MIT
# ReachInbox Onebox Email Aggregator

A feature-rich onebox email aggregator with real-time IMAP synchronization, AI-powered categorization, and intelligent reply suggestions.

## Features

### ✅ Implemented Features

1. **Real-Time Email Synchronization**
   - IMAP IDLE mode (no polling)
   - Syncs multiple IMAP accounts simultaneously
   - Fetches last 30 days of emails on initial sync
   - Automatic reconnection with exponential backoff
   - Persistent keepalive connections

2. **Searchable Storage with Elasticsearch**
   - Locally hosted Elasticsearch (Docker)
   - Full-text search with multi-match queries
   - Filter by folder and account
   - Indexed email fields for fast retrieval

3. **AI-Based Email Categorization**
   - Google Gemini AI integration
   - 8 categories: Interested, Meeting Booked, Not Interested, Out of Office, Follow Up, Spam, Important, Newsletter
   - Confidence scores with reasoning
   - Automatic classification on email receipt

4. **Slack & Webhook Integration**
   - Real-time Slack notifications for "Interested" emails
   - Webhook.site integration for external automation
   - Retry logic with exponential backoff
   - Parallel notification delivery

5. **Frontend Interface**
   - React + TypeScript frontend
   - Real-time email search
   - Filter by account and folder
   - AI category visualization
   - Responsive design

6. **AI-Powered Suggested Replies (Bonus)**
   - RAG (Retrieval-Augmented Generation) with Qdrant
   - Vector embeddings using Gemini
   - Product knowledge base
   - Context-aware reply suggestions

## Architecture

### Backend (Node.js + TypeScript)
- **Framework**: Express.js
- **Language**: TypeScript
- **Email Sync**: IMAP with persistent connections
- **Search**: Elasticsearch
- **AI**: Google Gemini API
- **Vector DB**: Qdrant (for RAG)
- **Notifications**: Slack API + Webhooks

### Frontend (React + Vite)
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **API Client**: Axios

### Infrastructure
- **Elasticsearch**: 7.17.1 (Docker)
- **Qdrant**: Latest (Docker)
- **Docker Compose**: Orchestration

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for Elasticsearch and Qdrant)
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd reachinbox-onebox
```

### 2. Install Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd web
npm install
cd ..
```

### 3. Configure Environment Variables
```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your actual values
```

Required environment variables:
```env
# IMAP Configuration (for real email sync)
IMAP_USER=your_email@example.com
IMAP_PASS=your_password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993

# Gemini API Key (required for AI features)
GEMINI_API_KEY=your_api_key

# Elasticsearch (use mock mode if not running Docker)
ES_URL=mock://localhost:9200

# Qdrant (use mock mode if not running Docker)
QDRANT_URL=mock://localhost:6333

# Optional: Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK

# Optional: Webhook automation
WEBHOOK_SITE_URL=https://webhook.site/your-url
```

### 4. Start Docker Services (Optional)
```bash
# Start Elasticsearch and Qdrant
docker compose up -d

# Verify services are running
docker ps
```

**Note**: The application works in "mock mode" without Docker for development.

### 5. Populate Qdrant with Product Knowledge (Optional)
```bash
npm run populate-qdrant
```

### 6. Start the Application

**Terminal 1 - Backend:**
```bash
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```

### 7. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## API Endpoints

### Email Search
```http
GET /api/emails/search?q=<query>&account=<accountId>&folder=<folderName>
```

### Reply Suggestions
```http
POST /api/emails/:id/suggest-reply
Content-Type: application/json

{
  "accountId": "account-id"
}
```

### Health Check
```http
GET /health
```

## Testing

### Test IMAP Connection
```bash
npm run test:imap
```

### Test Email Classification
```bash
npm run test:classifier
```

### Test Notifications
```bash
npm run test:notifications
```

### Test Reply Suggestions
```bash
npm run test:reply
```

## Development Modes

### Mock Mode (No Docker Required)
Set `ES_URL=mock://localhost:9200` and `QDRANT_URL=mock://localhost:6333` in `.env` to run without Elasticsearch and Qdrant. This is useful for development.

### Full Mode (With Docker)
Start Docker services and use real URLs for Elasticsearch and Qdrant.

## Project Structure

```
reachinbox-onebox/
├── src/
│   ├── imapSync.ts        # IMAP synchronization logic
│   ├── classifier.ts      # AI email classification
│   ├── replySuggestion.ts # RAG-powered reply suggestions
│   ├── notify.ts          # Slack & webhook notifications
│   ├── search.ts          # Elasticsearch integration
│   └── index.ts           # Express server
├── web/
│   └── src/
│       ├── App.tsx        # Main React component
│       └── api.ts         # API client
├── docker-compose.yml     # Docker services
├── populate-qdrant.ts     # Seed Qdrant with knowledge
└── test-*.ts              # Test scripts
```

## Key Technical Decisions

1. **IMAP IDLE**: Used for real-time email sync without polling
2. **Elasticsearch**: Chosen for full-text search and scalability
3. **Qdrant**: Vector database for semantic search in RAG
4. **Gemini AI**: Google's powerful LLM for classification and generation
5. **Mock Mode**: Development mode that works without infrastructure

## Performance Optimizations

- Persistent IMAP connections with keepalive
- Exponential backoff for retries
- Batch email processing
- Efficient Elasticsearch indexing
- Vector similarity search for RAG

## Error Handling

- Automatic reconnection on IMAP failures
- Retry logic for API calls
- Graceful degradation in mock mode
- Comprehensive error logging

## Future Enhancements

- [ ] Email threading and conversation grouping
- [ ] Advanced filtering and search operators
- [ ] Email templates and snippets
- [ ] Calendar integration for meeting detection
- [ ] Multi-language support
- [ ] Email analytics and insights

## License

MIT

## Contact

For questions or issues, please create an issue in the repository.
