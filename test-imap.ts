import dotenv from 'dotenv';
import { imapSyncManager, ImapConfig } from './src/imapSync';

// Load environment variables
dotenv.config();

async function testImapConnection(): Promise<void> {
  console.log('🧪 Testing IMAP Connection...\n');

  // Validate required environment variables
  const requiredVars = ['IMAP_USER', 'IMAP_PASS', 'IMAP_HOST'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease create a .env file with your IMAP credentials.');
    process.exit(1);
  }

  const config: ImapConfig = {
    user: process.env.IMAP_USER!,
    password: process.env.IMAP_PASS!,
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: process.env.IMAP_TLS !== 'false'
  };

  console.log('📧 IMAP Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   TLS: ${config.tls}`);
  console.log('');

  const testAccountId = 'test-account';

  try {
    // Start IMAP connection
    await imapSyncManager.startImap(testAccountId, config);
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check connection status
    const status = imapSyncManager.getAccountStatus(testAccountId);
    
    if (status?.isConnected) {
      console.log('✅ IMAP connection successful!');
      console.log(`   Account ID: ${testAccountId}`);
      console.log(`   Connected: ${status.isConnected}`);
      console.log(`   Reconnect attempts: ${status.reconnectAttempts}`);
      
      // Keep connection alive for 30 seconds to test IDLE
      console.log('\n🔄 Testing IDLE for 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      console.log('✅ IMAP IDLE test completed successfully!');
      
    } else {
      console.log('❌ IMAP connection failed');
      console.log(`   Connected: ${status?.isConnected || false}`);
      console.log(`   Reconnect attempts: ${status?.reconnectAttempts || 0}`);
    }

  } catch (error) {
    console.error('❌ IMAP test failed:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await imapSyncManager.stopImap(testAccountId);
    console.log('✅ Test completed');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await imapSyncManager.stopAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await imapSyncManager.stopAll();
  process.exit(0);
});

// Run the test
testImapConnection().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
