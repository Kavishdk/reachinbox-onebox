import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { esClient } from './search';

export interface ReplySuggestion {
  reply: string;
  confidence: number;
  reasoning: string;
  retrievedContexts: Array<{
    content: string;
    score: number;
    source: string;
  }>;
}

export interface ProductData {
  id: string;
  title: string;
  description: string;
  features: string[];
  pricing: string;
  category: string;
  content: string; // Full text content for embedding
}

class ReplySuggestionService {
  private genAI: GoogleGenerativeAI;
  private qdrantClient: QdrantClient;
  private readonly COLLECTION_NAME = 'product-knowledge';
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY = 1000;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'mock-key';
    // Allow mock mode in development
    if (apiKey === 'mock-key') {
      this.genAI = {
        getGenerativeModel: () => ({
          embedContent: async () => ({ embedding: { values: new Array(768).fill(0) } }),
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                reply: "This is a mock reply for testing.",
                confidence: 0.85,
                reasoning: "Mock reasoning - no real AI used."
              })
            }
          })
        })
      } as any;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.qdrantClient = new QdrantClient({ 
      url: qdrantUrl.startsWith('mock://') ? 'http://localhost:6333' : qdrantUrl,
      // Override fetch for mock mode
      ...(qdrantUrl.startsWith('mock://') ? {
        async request() {
          return {
            points: [],
            collections: []
          };
        }
      } : {})
    });
  }

  /**
   * Generate reply suggestion for an email using RAG (Retrieval-Augmented Generation)
   */
  async suggestReply(emailId: string, accountId: string): Promise<ReplySuggestion> {
    try {
      console.log(`🤖 Generating reply suggestion for email: ${emailId}`);
      
      // 1. Get email from Elasticsearch
      const email = await this.getEmailFromES(emailId, accountId);
      if (!email) {
        throw new Error(`Email ${emailId} not found`);
      }

      // 2. Create embedding for the email
      const emailEmbedding = await this.createEmbedding(email.subject + ' ' + email.body);
      
      // 3. Search Qdrant for relevant product knowledge (K=3)
      const relevantContexts = await this.searchProductKnowledge(emailEmbedding, 3);
      
      // 4. Generate reply using retrieved contexts
      const reply = await this.generateReplyWithContext(email, relevantContexts);
      
      console.log(`✅ Reply suggestion generated for email: ${emailId}`);
      return reply;
      
    } catch (error) {
      console.error(`❌ Failed to generate reply suggestion for ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Get email document from Elasticsearch
   */
  private async getEmailFromES(emailId: string, accountId: string): Promise<any | null> {
    try {
      const indexName = `emails-${accountId}`;
      
      const response = await esClient.get({
        index: indexName,
        id: emailId
      });
      
      return response._source;
    } catch (error) {
      console.error(`❌ Failed to get email from ES:`, error);
      return null;
    }
  }

  /**
   * Create embedding using Gemini
   */
  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'embedding-001' });
      
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('❌ Failed to create embedding:', error);
      throw error;
    }
  }

  /**
   * Search Qdrant for relevant product knowledge
   */
  private async searchProductKnowledge(embedding: number[], limit: number = 3): Promise<Array<{
    content: string;
    score: number;
    source: string;
  }>> {
    try {
      const searchResult = await this.qdrantClient.search(this.COLLECTION_NAME, {
        vector: embedding,
        limit: limit,
        with_payload: true,
        with_vector: false
      });

      return searchResult.map((result: any) => ({
        content: typeof result.payload?.content === 'string'
          ? result.payload.content
          : JSON.stringify(result.payload?.content || ''),
        score: result.score || 0,
        source: typeof result.payload?.source === 'string'
          ? result.payload.source
          : String(result.payload?.source || 'unknown')
      }));
    } catch (error) {
      console.error('❌ Failed to search Qdrant:', error);
      // Return empty array if search fails
      return [];
    }
  }

  /**
   * Generate reply using Gemini with retrieved contexts
   */
  private async generateReplyWithContext(
    email: any, 
    contexts: Array<{ content: string; score: number; source: string }>
  ): Promise<ReplySuggestion> {
    const prompt = this.buildReplyPrompt(email, contexts);
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseReplyResponse(text, contexts);
    } catch (error) {
      console.error('❌ Failed to generate reply:', error);
      throw error;
    }
  }

  /**
   * Build prompt for reply generation with system instruction and contexts
   */
  private buildReplyPrompt(email: any, contexts: Array<{ content: string; score: number; source: string }>): string {
    const contextText = contexts.map((ctx, i) => 
      `Context ${i + 1} (Score: ${ctx.score.toFixed(3)}):\n${ctx.content}\n`
    ).join('\n');

    return `You are a professional email assistant for ReachInbox. Your task is to generate a helpful, professional reply to the following email.

SYSTEM INSTRUCTIONS:
- Be professional, courteous, and helpful
- Use the provided product knowledge contexts to inform your response
- Keep replies concise but informative
- Match the tone and formality of the original email
- If the email is a business inquiry, provide relevant product information
- If it's a complaint, be empathetic and solution-oriented
- Always end with a clear call-to-action or next step

PRODUCT KNOWLEDGE CONTEXTS:
${contextText}

ORIGINAL EMAIL:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

Body:
${email.body}

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object in this exact format:
{
  "reply": "Your professional reply here...",
  "confidence": 0.85,
  "reasoning": "Brief explanation of your approach and key points addressed"
}

The confidence should be a number between 0.0 and 1.0.
The reasoning should explain how you used the contexts and what approach you took.

Respond with ONLY the JSON object, no additional text or formatting.`;
  }

  /**
   * Parse reply response from Gemini
   */
  private parseReplyResponse(response: string, contexts: Array<{ content: string; score: number; source: string }>): ReplySuggestion {
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Parse JSON
      const parsed = JSON.parse(cleanResponse);
      
      // Validate required fields
      if (!parsed.reply || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response format: missing required fields');
      }
      
      return {
        reply: parsed.reply,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        retrievedContexts: contexts
      };
    } catch (error) {
      console.error('❌ Failed to parse reply response:', error);
      console.error('Raw response:', response);
      
      // Return fallback response
      return {
        reply: 'Thank you for your email. I appreciate you reaching out and will review your message carefully. Please let me know if you have any specific questions or if there\'s anything else I can help you with.',
        confidence: 0.5,
        reasoning: 'Failed to parse AI response, using fallback reply',
        retrievedContexts: contexts
      };
    }
  }

  /**
   * Ensure Qdrant collection exists
   */
  async ensureCollectionExists(): Promise<void> {
    try {
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.COLLECTION_NAME
      );

      if (!collectionExists) {
        await this.qdrantClient.createCollection(this.COLLECTION_NAME, {
          vectors: {
            size: 768, // Gemini embedding-001 dimension
            distance: 'Cosine'
          }
        });
        console.log(`📁 Created Qdrant collection: ${this.COLLECTION_NAME}`);
      }
    } catch (error) {
      console.error('❌ Failed to ensure collection exists:', error);
      throw error;
    }
  }

  /**
   * Add product data to Qdrant with embeddings
   */
  async addProductData(productData: ProductData): Promise<void> {
    try {
      await this.ensureCollectionExists();
      
      // Create embedding for the product content
      const embedding = await this.createEmbedding(productData.content);
      
      // Add to Qdrant
      await this.qdrantClient.upsert(this.COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: productData.id,
            vector: embedding,
            payload: {
              title: productData.title,
              description: productData.description,
              features: productData.features,
              pricing: productData.pricing,
              category: productData.category,
              content: productData.content,
              source: 'product-data'
            }
          }
        ]
      });
      
      console.log(`✅ Added product data to Qdrant: ${productData.title}`);
    } catch (error) {
      console.error(`❌ Failed to add product data:`, error);
      throw error;
    }
  }

  /**
   * Batch add multiple product data items
   */
  async batchAddProductData(productDataList: ProductData[]): Promise<void> {
    console.log(`📦 Adding ${productDataList.length} product data items to Qdrant...`);
    
    for (const productData of productDataList) {
      try {
        await this.addProductData(productData);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to add product data ${productData.id}:`, error);
        // Continue with other items even if one fails
      }
    }
    
    console.log(`✅ Completed batch addition of product data`);
  }
}

// Export singleton instance
export const replySuggestionService = new ReplySuggestionService();
export { ReplySuggestionService };
