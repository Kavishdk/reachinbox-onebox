import dotenv from 'dotenv';
import { emailClassifier, ClassificationRequest } from './src/classifier';

// Load environment variables
dotenv.config();

async function testEmailClassifier(): Promise<void> {
  console.log('🧪 Testing Email Classifier...\n');

  // Validate required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Missing required environment variable: GEMINI_API_KEY');
    console.error('Please add your Gemini API key to the .env file.');
    process.exit(1);
  }

  console.log('✅ Gemini API key found');
  console.log('');

  // Test email samples
  const testEmails: ClassificationRequest[] = [
    {
      emailId: 'test-1',
      accountId: 'test-account',
      subject: 'Exciting Business Opportunity - Partnership Proposal',
      body: 'Hi there! I hope this email finds you well. I wanted to reach out because I believe there\'s a fantastic opportunity for us to work together. Our company has been following your work and we\'re impressed with your innovative approach. We\'d love to discuss a potential partnership that could benefit both our organizations. Would you be interested in a brief call next week to explore this further?',
      from: 'business@example.com',
      to: ['recipient@example.com']
    },
    {
      emailId: 'test-2',
      accountId: 'test-account',
      subject: 'Weekly Newsletter - Tech Updates',
      body: 'Welcome to our weekly tech newsletter! This week we cover the latest developments in AI, cloud computing, and cybersecurity. Don\'t miss our featured article on quantum computing breakthroughs. Subscribe to get these updates delivered to your inbox every Tuesday.',
      from: 'newsletter@technews.com',
      to: ['subscriber@example.com']
    },
    {
      emailId: 'test-3',
      accountId: 'test-account',
      subject: 'URGENT: Server Down - Immediate Action Required',
      body: 'Our production server is currently down and affecting all users. This is a critical issue that needs immediate attention. Please respond ASAP with your availability to help resolve this issue. Estimated downtime: 2-4 hours if not addressed quickly.',
      from: 'admin@company.com',
      to: ['dev-team@company.com']
    },
    {
      emailId: 'test-4',
      accountId: 'test-account',
      subject: 'Win $1000 - Click Here Now!',
      body: 'CONGRATULATIONS! You\'ve been selected to win $1000! Click the link below to claim your prize immediately. Limited time offer! Don\'t miss out on this amazing opportunity!',
      from: 'winner@spam.com',
      to: ['victim@example.com']
    }
  ];

  try {
    console.log('📧 Testing email classification...\n');

    for (const email of testEmails) {
      console.log(`\n📬 Testing email: "${email.subject}"`);
      console.log(`From: ${email.from}`);
      console.log(`Body preview: ${email.body.substring(0, 100)}...`);
      
      try {
        const result = await emailClassifier.classifyEmail(email);
        
        console.log(`✅ Classification Result:`);
        console.log(`   Category: ${result.category}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${result.reasoning}`);
        
      } catch (error) {
        console.error(`❌ Classification failed:`, error);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Email classification test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

// Run the test
testEmailClassifier().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
