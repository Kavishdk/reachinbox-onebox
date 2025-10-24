export interface ClassificationResult {
    category: 'Interested' | 'Not Interested' | 'Follow Up' | 'Spam' | 'Important' | 'Newsletter';
    confidence: number;
    reasoning?: string;
}
export interface ClassificationRequest {
    emailId: string;
    accountId: string;
    subject: string;
    body: string;
    from: string;
    to: string[];
}
declare class EmailClassifier {
    private genAI;
    private readonly MAX_RETRIES;
    private readonly INITIAL_DELAY;
    private readonly MAX_DELAY;
    constructor();
    /**
     * Classify an email using Gemini API with strict JSON schema
     */
    classifyEmail(request: ClassificationRequest): Promise<ClassificationResult>;
    /**
     * Classify email and update Elasticsearch document
     */
    classifyAndUpdateEmail(request: ClassificationRequest): Promise<ClassificationResult>;
    /**
     * Build the classification prompt with strict JSON schema
     */
    private buildClassificationPrompt;
    /**
     * Call Gemini API with exponential backoff retry logic
     */
    private callGeminiWithRetry;
    /**
     * Check if error is a rate limit error
     */
    private isRateLimitError;
    /**
     * Check if error is temporary and retryable
     */
    private isTemporaryError;
    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay;
    /**
     * Sleep utility function
     */
    private sleep;
    /**
     * Parse classification result from Gemini response
     */
    private parseClassificationResult;
    /**
     * Update email classification in Elasticsearch
     */
    private updateEmailClassification;
    /**
     * Get email document from Elasticsearch
     */
    private getEmailDocument;
    /**
     * Batch classify multiple emails
     */
    batchClassifyEmails(requests: ClassificationRequest[]): Promise<ClassificationResult[]>;
}
export declare const emailClassifier: EmailClassifier;
export { EmailClassifier };
//# sourceMappingURL=classifier.d.ts.map