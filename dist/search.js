"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esClient = void 0;
exports.indexEmail = indexEmail;
exports.searchEmails = searchEmails;
const elasticsearch_1 = require("@elastic/elasticsearch");
// Mock data for development
const mockEmails = [
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
// Initialize Elasticsearch client only when not in mock mode
// Initialize Elasticsearch client or use a mock client
const esClient = process.env.ES_URL?.startsWith('mock://')
    ? null // Mock client will never be used since all operations check mock:// first
    : new elasticsearch_1.Client({
        node: process.env.ES_URL || 'http://localhost:9200'
    });
exports.esClient = esClient;
async function indexEmail(emailDoc) {
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
        await esClient.index({
            index: indexName,
            id: emailDoc.id,
            document: {
                ...emailDoc,
                date: emailDoc.date.toISOString(),
                indexedAt: emailDoc.indexedAt.toISOString()
            }
        });
        console.log(`✅ Indexed email: ${emailDoc.subject} (${emailDoc.id})`);
    }
    catch (error) {
        console.error(`❌ Failed to index email ${emailDoc.id}:`, error);
        throw error;
    }
}
async function ensureIndexExists(indexName) {
    const exists = await esClient.indices.exists({ index: indexName });
    if (!exists) {
        await esClient.indices.create({
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
async function searchEmails(accountId, query, from, size) {
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
        const response = await esClient.search({
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
        const hits = response.hits.hits.map((hit) => ({
            ...hit._source,
            date: new Date(hit._source.date),
            indexedAt: new Date(hit._source.indexedAt)
        }));
        return {
            hits,
            total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0
        };
    }
    catch (error) {
        console.error(`❌ Failed to search emails:`, error);
        if (process.env.ES_URL?.startsWith('mock://')) {
            // Return empty results in mock mode on error
            return { hits: [], total: 0 };
        }
        throw error;
    }
}
//# sourceMappingURL=search.js.map