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
    content: string;
}
declare class ReplySuggestionService {
    private genAI;
    private qdrantClient;
    private readonly COLLECTION_NAME;
    private readonly MAX_RETRIES;
    private readonly INITIAL_DELAY;
    constructor();
    /**
     * Generate reply suggestion for an email using RAG (Retrieval-Augmented Generation)
     */
    suggestReply(emailId: string, accountId: string): Promise<ReplySuggestion>;
    /**
     * Get email document from Elasticsearch
     */
    private getEmailFromES;
    /**
     * Create embedding using Gemini
     */
    private createEmbedding;
    /**
     * Search Qdrant for relevant product knowledge
     */
    private searchProductKnowledge;
    /**
     * Generate reply using Gemini with retrieved contexts
     */
    private generateReplyWithContext;
    /**
     * Build prompt for reply generation with system instruction and contexts
     */
    private buildReplyPrompt;
    /**
     * Parse reply response from Gemini
     */
    private parseReplyResponse;
    /**
     * Ensure Qdrant collection exists
     */
    ensureCollectionExists(): Promise<void>;
    /**
     * Add product data to Qdrant with embeddings
     */
    addProductData(productData: ProductData): Promise<void>;
    /**
     * Batch add multiple product data items
     */
    batchAddProductData(productDataList: ProductData[]): Promise<void>;
}
export declare const replySuggestionService: ReplySuggestionService;
export { ReplySuggestionService };
//# sourceMappingURL=replySuggestion.d.ts.map