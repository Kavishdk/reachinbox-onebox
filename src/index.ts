import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { replySuggestionService } from './replySuggestion';
import { searchEmails } from './search';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/emails', (req, res) => {
  res.json({
    message: 'Emails endpoint - ready for implementation',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/emails/search', async (req, res) => {
  try {
    const { q: query, account, folder } = req.query;
    
    // For now, use a default account if none provided
    const accountId = (account as string) || 'default-account';
    
    const results = await searchEmails(
      accountId,
      (query as string) || '',
      0,
      50
    );
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Failed to search emails',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reply suggestion endpoint
app.post('/api/emails/:id/suggest-reply', async (req, res) => {
  try {
    const { id: emailId } = req.params;
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({
        error: 'accountId is required in request body'
      });
    }
    
    const suggestion = await replySuggestionService.suggestReply(emailId, accountId);
    
    res.json(suggestion);
  } catch (error) {
    console.error('Reply suggestion error:', error);
    res.status(500).json({
      error: 'Failed to generate reply suggestion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ReachInbox server running on port ${PORT}`);
  console.log(`📧 Email endpoints available at:`);
  console.log(`   GET /api/emails`);
  console.log(`   GET /api/emails/search`);
  console.log(`   POST /api/emails/:id/suggest-reply`);
  console.log(`🏥 Health check at /health`);
});

export default app;
