import { GoogleGenerativeAI } from '@google/generative-ai';
import { esClient } from './search';
import { notificationService } from './notify';

export interface ClassificationResult {
  category: 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Out of Office' | 'Follow Up' | 'Spam' | 'Important' | 'Newsletter';
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

class EmailClassifier {
  private genAI: GoogleGenerativeAI;
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_DELAY = 1000; // 1 second
  private readonly MAX_DELAY = 30000; // 30 seconds

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
      } as any;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Preprocess email text to improve classification accuracy
   */
  private preprocessEmail(text: string): string {
    // Remove email signatures (usually marked with -- or ---)
    const lines = text.split('\n');
    let processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Stop at common signature indicators
      if (line.match(/^[-=]{2,}/) || 
          line.toLowerCase().includes('sent from') ||
          line.toLowerCase().includes('best regards') ||
          line.toLowerCase().includes('kind regards')) {
        break;
      }
      
      // Remove quoted email content (lines starting with >)
      if (line.startsWith('>')) {
        continue;
      }
      
      processedLines.push(lines[i]);
    }
    
    let processed = processedLines.join('\n');
    
    // Remove long URLs (might be noisy)
    processed = processed.replace(/https?:\/\/[^\s]+/g, '[URL]');
    
    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }

  /**
   * Classify an email using Gemini API with strict JSON schema
   */
  async classifyEmail(request: ClassificationRequest): Promise<ClassificationResult> {
    // Preprocess the email body for better accuracy
    const processedBody = this.preprocessEmail(request.body);
    const processedRequest = { ...request, body: processedBody };
    
    const prompt = this.buildClassificationPrompt(processedRequest);
    
    try {
      const result = await this.callGeminiWithRetry(prompt);
      return this.parseClassificationResult(result);
    } catch (error) {
      console.error(`❌ Failed to classify email ${request.emailId}:`, error);
      throw error;
    }
  }

  /**
   * Classify email and update Elasticsearch document
   */
  async classifyAndUpdateEmail(request: ClassificationRequest): Promise<ClassificationResult> {
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
            await notificationService.notifyInterested(emailDoc);
          }
        } catch (error) {
          console.error(`❌ Failed to send notification for interested email ${request.emailId}:`, error);
          // Don't throw - classification succeeded, notification failure shouldn't break the flow
        }
      }
      
      return classification;
    } catch (error) {
      console.error(`❌ Failed to classify and update email ${request.emailId}:`, error);
      throw error;
    }
  }

  /**
   * Build the classification prompt with strict JSON schema
   */
  private buildClassificationPrompt(request: ClassificationRequest): string {
    return `You are an expert email classification AI specializing in business outreach and lead qualification. Analyze the following email and classify it into ONE of the predefined categories.

EMAIL DETAILS:
From: ${request.from}
To: ${request.to.join(', ')}
Subject: ${request.subject}
Body: ${request.body.substring(0, 3000)}${request.body.length > 3000 ? '...' : ''}

CLASSIFICATION CATEGORIES WITH EXAMPLES:

1. "Interested"
   - Shows genuine interest in product/service/proposal
   - Asks questions about features, pricing, availability
   - Requests more information, demo, or pricing details
   - Expresses positive sentiment like "interested", "would like to", "let's discuss"
   - Example: "I'm interested in learning more about your product" or "Can we schedule a demo?"

2. "Meeting Booked"
   - Confirms a meeting or appointment is scheduled
   - Contains calendar links, meeting times, or location details
   - Includes phrases like "see you on", "meeting confirmed", "calendar invite sent"
   - Example: "Looking forward to our meeting on Monday at 2 PM"

3. "Not Interested"
   - Clear rejection or decline
   - Explicit statements of "not interested", "pass", "not a good fit"
   - Asks to be removed from mailing list
   - Shows negative sentiment about the offer
   - Example: "Not interested at this time" or "We're not looking for this"

4. "Out of Office"
   - Automated out-of-office or vacation reply
   - Contains phrases like "out of office", "on vacation", "away from email"
   - Usually includes return date
   - May mention emergency contact or alternate person
   - Example: "I am currently out of office and will return on [date]"

5. "Spam"
   - Unsolicited commercial emails or suspicious content
   - Promotional offers, scams, phishing attempts
   - Misspellings, poor grammar, suspicious links
   - Generic mass marketing content
   - Example: Generic promotional emails or suspicious offers

6. "Follow Up"
   - Requires action or response (default category if unclear)
   - Questions that need answers
   - Status updates or progress reports
   - Not clearly fitting other categories but needs attention

7. "Important"
   - Urgent business matters
   - Contract discussions, time-sensitive decisions
   - Escalated issues or complaints
   - High-value opportunities requiring immediate attention

8. "Newsletter"
   - Regular updates, newsletters, automated content
   - Mass distribution emails
   - Subscriptions or automated notifications
   - Content updates or blog posts

ANALYSIS INSTRUCTIONS:
1. Read the ENTIRE email carefully (subject + body)
2. Identify the PRIMARY intent of the email
3. Check if it clearly matches one of the first 5 categories (Interested, Meeting Booked, Not Interested, Out of Office, Spam)
4. If uncertain, default to "Follow Up"
5. Provide a confidence score: 0.9+ (very certain), 0.7-0.9 (confident), 0.5-0.7 (somewhat confident), <0.5 (uncertain)
6. Explain your reasoning in 1-2 sentences

RESPONSE FORMAT (JSON ONLY - NO OTHER TEXT):
{
  "category": "exact category name from above",
  "confidence": 0.85,
  "reasoning": "Clear 1-2 sentence explanation"
}

CRITICAL: Respond with ONLY the JSON object. No markdown, no code blocks, no additional text.`;
  }

  /**
   * Call Gemini API with exponential backoff retry logic
   */
  private async callGeminiWithRetry(prompt: string, attempt: number = 1): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent classification
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 500,
          responseMimeType: "application/json"
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }
      
      return text.trim();
    } catch (error: any) {
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
  private isRateLimitError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code;
    
    return (
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('too many requests')
    );
  }

  /**
   * Check if error is temporary and retryable
   */
  private isTemporaryError(error: any): boolean {
    const status = error.status || error.code;
    const message = error.message?.toLowerCase() || '';
    
    return (
      status >= 500 ||
      status === 408 ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network')
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = this.INITIAL_DELAY * Math.pow(2, attempt - 1);
    return Math.min(delay, this.MAX_DELAY);
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse classification result from Gemini response
   */
  private parseClassificationResult(response: string): ClassificationResult {
    try {
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Remove any leading/trailing non-JSON text
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      // Parse JSON
      const parsed = JSON.parse(cleanResponse);
      
      // Validate required fields
      if (!parsed.category || parsed.confidence === undefined) {
        throw new Error('Invalid response format: missing required fields');
      }
      
      // Validate category (case-insensitive match)
      const validCategories = ['Interested', 'Meeting Booked', 'Not Interested', 'Out of Office', 'Follow Up', 'Spam', 'Important', 'Newsletter'];
      const normalizedCategory = parsed.category.trim();
      
      if (!validCategories.includes(normalizedCategory)) {
        console.warn(`⚠️ Invalid category received: ${normalizedCategory}`);
        // Try to match with case-insensitive comparison
        const matchedCategory = validCategories.find(cat => 
          cat.toLowerCase() === normalizedCategory.toLowerCase()
        );
        
        if (matchedCategory) {
          parsed.category = matchedCategory;
          console.log(`✅ Mapped ${normalizedCategory} to ${matchedCategory}`);
        } else {
          throw new Error(`Invalid category: ${normalizedCategory}`);
        }
      }
      
      // Validate and normalize confidence
      let confidence = parsed.confidence;
      if (typeof confidence === 'string') {
        confidence = parseFloat(confidence);
      }
      if (isNaN(confidence) || confidence < 0) confidence = 0.5;
      if (confidence > 1) confidence = 1.0;
      
      return {
        category: parsed.category,
        confidence: confidence,
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
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
  private async updateEmailClassification(
    emailId: string, 
    accountId: string, 
    classification: ClassificationResult
  ): Promise<void> {
    try {
      const indexName = `emails-${accountId}`;
      
      await esClient.update({
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
    } catch (error) {
      console.error(`❌ Failed to update ES document ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Get email document from Elasticsearch
   */
  private async getEmailDocument(emailId: string, accountId: string): Promise<any | null> {
    try {
      const indexName = `emails-${accountId}`;
      
      const response = await esClient.get({
        index: indexName,
        id: emailId
      });
      
      return response._source;
    } catch (error) {
      console.error(`❌ Failed to get email document ${emailId}:`, error);
      return null;
    }
  }

  /**
   * Batch classify multiple emails
   */
  async batchClassifyEmails(requests: ClassificationRequest[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    // Process emails in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (request) => {
        try {
          return await this.classifyAndUpdateEmail(request);
        } catch (error) {
          console.error(`❌ Failed to classify email in batch: ${request.emailId}`);
          return {
            category: 'Follow Up' as const,
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

// Export singleton instance
export const emailClassifier = new EmailClassifier();
export { EmailClassifier };
