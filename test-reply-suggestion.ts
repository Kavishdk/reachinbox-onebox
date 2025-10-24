import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

async function testReplySuggestion(): Promise<void> {
  console.log('🧪 Testing Reply Suggestion API...\n');

  // Validate required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Missing required environment variable: GEMINI_API_KEY');
    process.exit(1);
  }

  if (!process.env.QDRANT_URL) {
    console.error('❌ Missing required environment variable: QDRANT_URL');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(`📊 Qdrant URL: ${process.env.QDRANT_URL}`);
  console.log('');

  const baseURL = 'http://localhost:3000';
  const testEmailId = 'test-email-reply-' + Date.now();
  const testAccountId = 'test-account';

  try {
    // First, populate Qdrant with product data
    console.log('📦 Populating Qdrant with product data...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('npm run populate-qdrant');
      console.log('✅ Qdrant populated successfully\n');
    } catch (error) {
      console.log('⚠️ Qdrant population failed, but continuing with test...\n');
    }

    // Test the reply suggestion endpoint
    console.log('🤖 Testing reply suggestion endpoint...');
    console.log(`📧 Email ID: ${testEmailId}`);
    console.log(`👤 Account ID: ${testAccountId}`);
    console.log('');

    const response = await axios.post(`${baseURL}/api/emails/${testEmailId}/suggest-reply`, {
      accountId: testAccountId
    }, {
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ Reply suggestion generated successfully!');
    console.log('');
    console.log('📊 Response:');
    console.log(`   Reply: ${response.data.reply}`);
    console.log(`   Confidence: ${(response.data.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${response.data.reasoning}`);
    console.log(`   Retrieved Contexts: ${response.data.retrievedContexts.length}`);
    
    if (response.data.retrievedContexts.length > 0) {
      console.log('');
      console.log('📚 Retrieved Contexts:');
      response.data.retrievedContexts.forEach((context: any, index: number) => {
        console.log(`   ${index + 1}. Score: ${context.score.toFixed(3)} | Source: ${context.source}`);
        console.log(`      Content: ${context.content.substring(0, 100)}...`);
      });
    }

  } catch (error: any) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ Network Error: Could not reach the server');
      console.error('   Make sure the backend server is running on port 3000');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

// Run the test
testReplySuggestion().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
