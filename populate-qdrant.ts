import dotenv from 'dotenv';
import { replySuggestionService, ProductData } from './src/replySuggestion';

// Load environment variables
dotenv.config();

async function populateQdrantWithProductData(): Promise<void> {
  console.log('🚀 Starting Qdrant population with product data...\n');

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

  // Sample product data - in a real scenario, this would come from a database or API
  const productData: ProductData[] = [
    {
      id: 'product-1',
      title: 'ReachInbox Pro',
      description: 'Advanced email management and AI-powered inbox optimization',
      features: [
        'AI-powered email classification',
        'Smart reply suggestions',
        'Priority inbox filtering',
        'Email analytics dashboard',
        'Team collaboration tools'
      ],
      pricing: '$29/month per user',
      category: 'Email Management',
      content: `ReachInbox Pro is our flagship email management solution designed for busy professionals and teams. 

Key Features:
- AI-powered email classification automatically categorizes your emails into Interested, Not Interested, Follow Up, Spam, Important, and Newsletter categories
- Smart reply suggestions use advanced AI to generate contextual, professional responses based on your product knowledge base
- Priority inbox filtering ensures you never miss important emails
- Comprehensive email analytics dashboard provides insights into your email patterns and productivity
- Team collaboration tools allow seamless sharing and delegation of emails

Pricing: $29/month per user with volume discounts available for teams of 10+ users.

Perfect for sales teams, customer support, and business development professionals who need to stay on top of their email communications.`
    },
    {
      id: 'product-2',
      title: 'ReachInbox Enterprise',
      description: 'Enterprise-grade email management with advanced security and compliance',
      features: [
        'Advanced security features',
        'Compliance and audit trails',
        'Custom AI model training',
        'Dedicated support',
        'On-premise deployment option'
      ],
      pricing: 'Contact sales for pricing',
      category: 'Enterprise Solutions',
      content: `ReachInbox Enterprise is designed for large organizations requiring advanced security, compliance, and customization capabilities.

Enterprise Features:
- Advanced security features including end-to-end encryption, SSO integration, and multi-factor authentication
- Comprehensive compliance and audit trails meeting SOC 2, GDPR, and HIPAA requirements
- Custom AI model training allows organizations to fine-tune email classification for their specific industry and use cases
- Dedicated support with 24/7 availability and dedicated account managers
- On-premise deployment option for organizations with strict data residency requirements

Security & Compliance:
- SOC 2 Type II certified
- GDPR compliant with data processing agreements
- HIPAA compliant for healthcare organizations
- Regular security audits and penetration testing

Perfect for Fortune 500 companies, government agencies, and organizations in highly regulated industries.`
    },
    {
      id: 'product-3',
      title: 'ReachInbox API',
      description: 'Developer-friendly API for integrating email intelligence into your applications',
      features: [
        'RESTful API endpoints',
        'Webhook support',
        'Rate limiting and quotas',
        'Comprehensive documentation',
        'SDK libraries for popular languages'
      ],
      pricing: '$0.01 per API call',
      category: 'Developer Tools',
      content: `ReachInbox API provides developers with powerful email intelligence capabilities that can be integrated into any application.

API Capabilities:
- RESTful API endpoints for email classification, reply suggestions, and analytics
- Real-time webhook support for instant notifications when emails are processed
- Flexible rate limiting and quotas to match your application's needs
- Comprehensive API documentation with interactive examples and code samples
- SDK libraries available for Python, Node.js, Java, C#, and Go

Use Cases:
- CRM integration for automatic lead scoring
- Customer support ticket routing
- Email marketing campaign optimization
- Compliance monitoring and reporting
- Custom email workflows and automation

Pricing: $0.01 per API call with volume discounts starting at 10,000 calls per month.

Perfect for SaaS companies, CRM providers, and developers building email-centric applications.`
    },
    {
      id: 'product-4',
      title: 'ReachInbox Analytics',
      description: 'Advanced email analytics and reporting for data-driven email management',
      features: [
        'Email performance metrics',
        'Response time analytics',
        'Team productivity insights',
        'Custom report builder',
        'Data export capabilities'
      ],
      pricing: '$19/month per user',
      category: 'Analytics',
      content: `ReachInbox Analytics transforms your email data into actionable insights for better decision-making and improved productivity.

Analytics Features:
- Email performance metrics including open rates, response times, and engagement scores
- Response time analytics help identify bottlenecks and optimize team performance
- Team productivity insights show individual and team-level email handling efficiency
- Custom report builder allows creation of tailored reports for different stakeholders
- Data export capabilities support CSV, Excel, and API integrations

Key Metrics:
- Average response time by team member
- Email volume trends and patterns
- Classification accuracy rates
- Customer satisfaction scores
- Team workload distribution

Pricing: $19/month per user with advanced features available in higher tiers.

Perfect for managers, team leads, and organizations focused on data-driven email management improvements.`
    },
    {
      id: 'product-5',
      title: 'ReachInbox Mobile',
      description: 'Mobile-first email management with offline capabilities',
      features: [
        'Native iOS and Android apps',
        'Offline email access',
        'Push notifications',
        'Voice-to-text replies',
        'Mobile-optimized interface'
      ],
      pricing: 'Included with Pro and Enterprise',
      category: 'Mobile Apps',
      content: `ReachInbox Mobile brings the power of AI-powered email management to your smartphone and tablet.

Mobile Features:
- Native iOS and Android apps with platform-specific optimizations
- Offline email access allows you to read and draft emails without internet connectivity
- Intelligent push notifications ensure you never miss important emails
- Voice-to-text reply functionality for hands-free email responses
- Mobile-optimized interface designed for touch interactions

Offline Capabilities:
- Download emails for offline reading
- Draft replies offline and sync when connected
- Access to AI classifications and suggestions
- Offline search functionality
- Automatic sync when connectivity is restored

Included with ReachInbox Pro and Enterprise subscriptions at no additional cost.

Perfect for busy professionals who need to stay connected and productive while on the go.`
    }
  ];

  try {
    // Ensure Qdrant collection exists
    console.log('📁 Ensuring Qdrant collection exists...');
    await replySuggestionService.ensureCollectionExists();
    console.log('✅ Collection ready\n');

    // Add product data to Qdrant
    console.log(`📦 Adding ${productData.length} product data items to Qdrant...`);
    await replySuggestionService.batchAddProductData(productData);
    
    console.log('\n✅ Successfully populated Qdrant with product data!');
    console.log(`📊 Added ${productData.length} product knowledge items`);
    console.log('🎯 Ready for reply suggestions with RAG capabilities');
    
  } catch (error) {
    console.error('❌ Failed to populate Qdrant:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Population interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Population terminated');
  process.exit(0);
});

// Run the population script
populateQdrantWithProductData().catch(error => {
  console.error('❌ Population failed:', error);
  process.exit(1);
});
