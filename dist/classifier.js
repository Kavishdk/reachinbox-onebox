"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailClassifier = exports.emailClassifier = void 0;
const generative_ai_1 = require("@google/generative-ai");
const search_1 = require("./search");
const notify_1 = require("./notify");
class EmailClassifier {
    genAI;
    MAX_RETRIES = 5;
    INITIAL_DELAY = 1000; // 1 second
    MAX_DELAY = 30000; // 30 seconds
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || 'mock-key';
        if (apiKey === 'mock-key') {
            this.genAI = {
                getGenerativeModel: () => ({
                    generateContent: async () => ({
                        response: {
                            text: () => JSON.stringify({
                                category: "Interested",
                                confidence: 0.85,
                                reasoning: "Mock classification - no real AI used."
                            })
                        }
                    })
                })
            };
        }
        else {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        }
    }
    /**
     * Classify an email using Gemini API with strict JSON schema
     */
    async classifyEmail(request) {
        const prompt = this.buildClassificationPrompt(request);
        try {
            const result = await this.callGeminiWithRetry(prompt);
            return this.parseClassificationResult(result);
        }
        catch (error) {
            console.error(`❌ Failed to classify email ${request.emailId}:`, error);
            throw error;
        }
    }
    /**
     * Classify email and update Elasticsearch document
     */
    async classifyAndUpdateEmail(request) {
        try {
            // Classify the email
            const classification = await this.classifyEmail(request);
            // Update Elasticsearch document
            await this.updateEmailClassification(request.emailId, request.accountId, classification);
            console.log(`✅ Classified email ${request.emailId} as: ${classification.category} (confidence: ${classification.confidence})`);
            // Send notifications for interested emails
            if (classification.category === 'Interested') {
                try {
                    const emailDoc = await this.getEmailDocument(request.emailId, request.accountId);
                    if (emailDoc) {
                        await notify_1.notificationService.notifyInterested(emailDoc);
                    }
                }
                catch (error) {
                    console.error(`❌ Failed to send notification for interested email ${request.emailId}:`, error);
                    // Don't throw - classification succeeded, notification failure shouldn't break the flow
                }
            }
            return classification;
        }
        catch (error) {
            console.error(`❌ Failed to classify and update email ${request.emailId}:`, error);
            throw error;
        }
    }
    /**
     * Build the classification prompt with strict JSON schema
     */
    buildClassificationPrompt(request) {
        return `You are an email classification AI. Analyze the following email and classify it into one of the predefined categories.

EMAIL DETAILS:
From: ${request.from}
To: ${request.to.join(', ')}
Subject: ${request.subject}
Body: ${request.body.substring(0, 2000)}${request.body.length > 2000 ? '...' : ''}

CLASSIFICATION CATEGORIES:
- "Interested": Email shows genuine interest in business/proposal
- "Not Interested": Clear rejection or lack of interest
- "Follow Up": Requires follow-up action or response
- "Spam": Unsolicited commercial email or suspicious content
- "Important": Urgent or high-priority business communication
- "Newsletter": Regular updates, newsletters, or automated content

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object in this exact format:
{
  "category": "one of the six categories above",
  "confidence": 0.85,
  "reasoning": "brief explanation of your classification"
}

The confidence should be a number between 0.0 and 1.0.
The reasoning should be a brief explanation of why you chose this category.

Respond with ONLY the JSON object, no additional text or formatting.`;
    }
    /**
     * Call Gemini API with exponential backoff retry logic
     */
    async callGeminiWithRetry(prompt, attempt = 1) {
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            if (!text) {
                throw new Error('Empty response from Gemini API');
            }
            return text.trim();
        }
        catch (error) {
            console.error(`❌ Gemini API call failed (attempt ${attempt}):`, error.message);
            // Check if it's a rate limit error
            if (this.isRateLimitError(error) && attempt < this.MAX_RETRIES) {
                const delay = this.calculateBackoffDelay(attempt);
                console.log(`⏳ Rate limited, retrying in ${delay}ms...`);
                await this.sleep(delay);
                return this.callGeminiWithRetry(prompt, attempt + 1);
            }
            // Check if it's a temporary error and we have retries left
            if (this.isTemporaryError(error) && attempt < this.MAX_RETRIES) {
                const delay = this.calculateBackoffDelay(attempt);
                console.log(`⏳ Temporary error, retrying in ${delay}ms...`);
                await this.sleep(delay);
                return this.callGeminiWithRetry(prompt, attempt + 1);
            }
            throw error;
        }
    }
    /**
     * Check if error is a rate limit error
     */
    isRateLimitError(error) {
        const message = error.message?.toLowerCase() || '';
        const status = error.status || error.code;
        return (status === 429 ||
            message.includes('rate limit') ||
            message.includes('quota exceeded') ||
            message.includes('too many requests'));
    }
    /**
     * Check if error is temporary and retryable
     */
    isTemporaryError(error) {
        const status = error.status || error.code;
        const message = error.message?.toLowerCase() || '';
        return (status >= 500 ||
            status === 408 ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('network'));
    }
    /**
     * Calculate exponential backoff delay
     */
    calculateBackoffDelay(attempt) {
        const delay = this.INITIAL_DELAY * Math.pow(2, attempt - 1);
        return Math.min(delay, this.MAX_DELAY);
    }
    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Parse classification result from Gemini response
     */
    parseClassificationResult(response) {
        try {
            // Clean the response - remove any markdown formatting
            let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            // Parse JSON
            const parsed = JSON.parse(cleanResponse);
            // Validate required fields
            if (!parsed.category || !parsed.confidence) {
                throw new Error('Invalid response format: missing required fields');
            }
            // Validate category
            const validCategories = ['Interested', 'Not Interested', 'Follow Up', 'Spam', 'Important', 'Newsletter'];
            if (!validCategories.includes(parsed.category)) {
                throw new Error(`Invalid category: ${parsed.category}`);
            }
            // Validate confidence
            if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
                throw new Error(`Invalid confidence: ${parsed.confidence}`);
            }
            return {
                category: parsed.category,
                confidence: parsed.confidence,
                reasoning: parsed.reasoning || ''
            };
        }
        catch (error) {
            console.error('❌ Failed to parse classification result:', error);
            console.error('Raw response:', response);
            // Return default classification if parsing fails
            return {
                category: 'Follow Up',
                confidence: 0.5,
                reasoning: 'Failed to parse AI response, defaulting to Follow Up'
            };
        }
    }
    /**
     * Update email classification in Elasticsearch
     */
    async updateEmailClassification(emailId, accountId, classification) {
        try {
            const indexName = `emails-${accountId}`;
            await search_1.esClient.update({
                index: indexName,
                id: emailId,
                doc: {
                    aiCategory: classification.category,
                    aiConfidence: classification.confidence,
                    aiReasoning: classification.reasoning,
                    classifiedAt: new Date().toISOString()
                }
            });
            console.log(`📝 Updated ES document ${emailId} with classification: ${classification.category}`);
        }
        catch (error) {
            console.error(`❌ Failed to update ES document ${emailId}:`, error);
            throw error;
        }
    }
    /**
     * Get email document from Elasticsearch
     */
    async getEmailDocument(emailId, accountId) {
        try {
            const indexName = `emails-${accountId}`;
            const response = await search_1.esClient.get({
                index: indexName,
                id: emailId
            });
            return response._source;
        }
        catch (error) {
            console.error(`❌ Failed to get email document ${emailId}:`, error);
            return null;
        }
    }
    /**
     * Batch classify multiple emails
     */
    async batchClassifyEmails(requests) {
        const results = [];
        // Process emails in batches to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(async (request) => {
                try {
                    return await this.classifyAndUpdateEmail(request);
                }
                catch (error) {
                    console.error(`❌ Failed to classify email in batch: ${request.emailId}`);
                    return {
                        category: 'Follow Up',
                        confidence: 0.5,
                        reasoning: 'Classification failed'
                    };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            // Small delay between batches
            if (i + batchSize < requests.length) {
                await this.sleep(1000);
            }
        }
        return results;
    }
}
exports.EmailClassifier = EmailClassifier;
// Export singleton instance
exports.emailClassifier = new EmailClassifier();
//# sourceMappingURL=classifier.js.map