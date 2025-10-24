import dotenv from 'dotenv';
import { notificationService } from './src/notify';
import { EmailDocument } from './src/search';

// Load environment variables
dotenv.config();

async function testNotifications(): Promise<void> {
  console.log('🧪 Testing Notification System...\n');

  // Validate required environment variables
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const webhookSiteUrl = process.env.WEBHOOK_SITE_URL;

  if (!slackWebhookUrl && !webhookSiteUrl) {
    console.error('❌ No notification URLs configured!');
    console.error('Please set at least one of:');
    console.error('  - SLACK_WEBHOOK_URL');
    console.error('  - WEBHOOK_SITE_URL');
    console.error('\nAdd these to your .env file.');
    process.exit(1);
  }

  console.log('📋 Notification Configuration:');
  if (slackWebhookUrl) {
    console.log(`   ✅ Slack Webhook: ${slackWebhookUrl.substring(0, 50)}...`);
  } else {
    console.log('   ❌ Slack Webhook: Not configured');
  }
  
  if (webhookSiteUrl) {
    console.log(`   ✅ Webhook Site: ${webhookSiteUrl}`);
  } else {
    console.log('   ❌ Webhook Site: Not configured');
  }
  console.log('');

  // Test with sample interested email
  const testEmail: EmailDocument = {
    id: 'test-notification-' + Date.now(),
    accountId: 'test-account',
    messageId: 'test-message-id',
    subject: 'Exciting Business Partnership Opportunity',
    from: 'partnerships@innovativetech.com',
    to: ['business@yourcompany.com'],
    cc: ['ceo@yourcompany.com'],
    date: new Date(),
    body: `Dear Business Development Team,

I hope this email finds you well. I'm reaching out from Innovative Tech Solutions, and I'm excited about the potential for a strategic partnership between our companies.

We've been following your recent product launches and are impressed by your innovative approach to solving complex business challenges. We believe there's a fantastic opportunity for us to collaborate and create mutual value.

Key Partnership Benefits:
• Access to our cutting-edge AI technology platform
• Joint go-to-market opportunities
• Shared R&D resources
• Expanded customer base for both companies

We'd love to schedule a brief call next week to discuss this opportunity in more detail. Would you be available for a 30-minute conversation?

Looking forward to hearing from you!

Best regards,
Sarah Johnson
Partnership Development Manager
Innovative Tech Solutions
Phone: +1 (555) 123-4567
Email: partnerships@innovativetech.com`,
    htmlBody: '<p>Dear Business Development Team,</p><p>I hope this email finds you well...</p>',
    attachments: [
      {
        filename: 'partnership-proposal.pdf',
        contentType: 'application/pdf',
        size: 1024000
      }
    ],
    flags: ['\\Seen'],
    uid: 12345,
    folder: 'INBOX',
    indexedAt: new Date(),
    aiCategory: 'Interested',
    aiConfidence: 0.92,
    aiReasoning: 'Email shows clear business interest with specific partnership proposal, professional tone, and concrete next steps for collaboration.',
    classifiedAt: new Date()
  };

  try {
    console.log('📧 Testing notification for interested email...');
    console.log(`   Subject: ${testEmail.subject}`);
    console.log(`   From: ${testEmail.from}`);
    console.log(`   AI Category: ${testEmail.aiCategory}`);
    console.log(`   Confidence: ${(testEmail.aiConfidence! * 100).toFixed(1)}%`);
    console.log('');

    const result = await notificationService.notifyInterested(testEmail);

    console.log('📊 Notification Results:');
    console.log(`   Overall Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Slack Success: ${result.slackSuccess ? '✅' : '❌'}`);
    console.log(`   Webhook Success: ${result.webhookSuccess ? '✅' : '❌'}`);
    console.log(`   Timestamp: ${result.timestamp.toISOString()}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.success) {
      console.log('\n✅ Notification test completed successfully!');
      console.log('Check your Slack channel and webhook.site dashboard for the notifications.');
    } else {
      console.log('\n❌ Notification test failed!');
      console.log('Please check your configuration and try again.');
    }

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
testNotifications().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
