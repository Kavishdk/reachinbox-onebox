import { Client } from '@elastic/elasticsearch';

// Mock data type matches EmailDocument exactly
type MockEmail = EmailDocument;

// Mock data for development
const mockEmails: MockEmail[] = [
  {
    id: 'mock-1',
    accountId: 'default-account',
    messageId: 'mock-msg-1',
    subject: 'Welcome to ReachInbox',
    from: 'support@reachinbox.com',
    to: ['user@example.com'],
    date: new Date(),
    body: 'Thank you for trying ReachInbox. This is a mock email for testing.',
    flags: ['\\Seen'],
    uid: 1,
    folder: 'INBOX',
    indexedAt: new Date()
  },
  {
    id: 'mock-2',
    accountId: 'default-account',
    messageId: 'mock-msg-2',
    subject: 'Meeting Tomorrow',
    from: 'alice@example.com',
    to: ['user@example.com'],
    date: new Date(),
    body: 'Hi, would you be available for a quick meeting tomorrow?',
    flags: ['\\Seen'],
    uid: 2,
    folder: 'INBOX',
    indexedAt: new Date()
  }
];

// Lazily create the Elasticsearch client so importing this module
// won't attempt to connect or check server compatibility at startup.
function getEsClient(): Client | null {
  if (process.env.ES_URL?.startsWith('mock://')) return null;

  // create a real client and skip compatibility check which can fail
  // in certain development setups
  return new Client({ node: process.env.ES_URL || 'http://localhost:9200', checkCompatibility: false });
}
export interface EmailDocument {
  id: string;
  accountId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
  flags: string[];
  uid: number;
  folder: string;
  indexedAt: Date;
  aiCategory?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  classifiedAt?: Date;
}

export async function indexEmail(emailDoc: EmailDocument): Promise<void> {
  try {
    // In mock mode, just add to our mock data
    if (process.env.ES_URL?.startsWith('mock://')) {
      mockEmails.push(emailDoc);
      console.log(`✅ Added email to mock data: ${emailDoc.subject} (${emailDoc.id})`);
      return;
    }

    const indexName = `emails-${emailDoc.accountId}`;
    
    // Ensure index exists with proper mapping
    await ensureIndexExists(indexName);

    // Index the email document
    const client = getEsClient();
    if (!client) throw new Error('Elasticsearch client not available');

    await client.index({
      index: indexName,
      id: emailDoc.id,
      document: {
        ...emailDoc,
        date: emailDoc.date.toISOString(),
        indexedAt: emailDoc.indexedAt.toISOString()
      }
    });
    
    console.log(`✅ Indexed email: ${emailDoc.subject} (${emailDoc.id})`);
  } catch (error) {
    console.error(`❌ Failed to index email ${emailDoc.id}:`, error);
    throw error;
  }
}

async function ensureIndexExists(indexName: string): Promise<void> {
  const client = getEsClient();
  if (!client) throw new Error('Elasticsearch client not available');

  const exists = await client.indices.exists({ index: indexName });

  if (!exists) {
    await client.indices.create({
      index: indexName,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          accountId: { type: 'keyword' },
          messageId: { type: 'keyword' },
          subject: { 
            type: 'text',
            analyzer: 'standard'
          },
          from: { type: 'keyword' },
          to: { type: 'keyword' },
          cc: { type: 'keyword' },
          bcc: { type: 'keyword' },
          date: { type: 'date' },
          body: { 
            type: 'text',
            analyzer: 'standard'
          },
          htmlBody: { 
            type: 'text',
            analyzer: 'standard'
          },
          attachments: {
            type: 'nested',
            properties: {
              filename: { type: 'keyword' },
              contentType: { type: 'keyword' },
              size: { type: 'long' }
            }
          },
          flags: { type: 'keyword' },
          uid: { type: 'long' },
          folder: { type: 'keyword' },
          indexedAt: { type: 'date' },
          aiCategory: { type: 'keyword' },
          aiConfidence: { type: 'float' },
          aiReasoning: { type: 'text' },
          classifiedAt: { type: 'date' }
        }
      }
    });
    
    console.log(`📁 Created Elasticsearch index: ${indexName}`);
  }
}

export async function searchEmails(
  accountId: string, 
  query: string, 
  from?: number, 
  size?: number
): Promise<{ hits: EmailDocument[]; total: number }> {
  try {
    // Return mock data in development mode
    if (process.env.ES_URL?.startsWith('mock://')) {
      const filtered = mockEmails.filter(email => {
        const searchText = `${email.subject} ${email.body} ${email.from} ${email.to.join(' ')}`.toLowerCase();
        return !query || searchText.includes(query.toLowerCase());
      });

      const start = from || 0;
      const end = start + (size || 10);

      return {
        hits: filtered.slice(start, end),
        total: filtered.length
      };
    }

    const indexName = `emails-${accountId}`;
    
    const client = getEsClient();
    if (!client) throw new Error('Elasticsearch client not available');

    const response = await client.search({
      index: indexName,
      from: from || 0,
      size: size || 10,
      query: {
        multi_match: {
          query: query,
          fields: ['subject^2', 'body', 'from', 'to']
        }
      },
      sort: [
        { date: { order: 'desc' } }
      ]
    });
    
    const hits = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      date: new Date(hit._source.date),
      indexedAt: new Date(hit._source.indexedAt)
    }));
    
    return {
      hits,
      total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0
    };
  } catch (error) {
    console.error(`❌ Failed to search emails:`, error);
    if (process.env.ES_URL?.startsWith('mock://')) {
      // Return empty results in mock mode on error
      return { hits: [], total: 0 };
    }
    throw error;
  }
}

export { esClient };
