import axios, { AxiosResponse } from 'axios';
import { EmailDocument } from './search';

export interface NotificationResult {
  success: boolean;
  slackSuccess: boolean;
  webhookSuccess: boolean;
  errors: string[];
  timestamp: Date;
}

export interface SlackMessage {
  text: string;
  blocks?: any[];
  attachments?: any[];
}

export interface WebhookPayload {
  emailId: string;
  accountId: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  aiCategory: string;
  aiConfidence: number;
  aiReasoning: string;
  timestamp: string;
}

class NotificationService {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY = 1000; // 1 second
  private readonly MAX_DELAY = 10000; // 10 seconds
  private readonly TIMEOUT = 10000; // 10 seconds

  /**
   * Notify about interested emails via Slack and webhook.site
   */
  async notifyInterested(emailDoc: EmailDocument): Promise<NotificationResult> {
    console.log(`🔔 Notifying about interested email: ${emailDoc.subject}`);
    
    const result: NotificationResult = {
      success: false,
      slackSuccess: false,
      webhookSuccess: false,
      errors: [],
      timestamp: new Date()
    };

    // Validate required environment variables
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const webhookSiteUrl = process.env.WEBHOOK_SITE_URL;

    if (!slackWebhookUrl && !webhookSiteUrl) {
      const error = 'No notification URLs configured (SLACK_WEBHOOK_URL or WEBHOOK_SITE_URL)';
      console.error(`❌ ${error}`);
      result.errors.push(error);
      return result;
    }

    // Send notifications in parallel
    const promises: Promise<void>[] = [];

    if (slackWebhookUrl) {
      promises.push(
        this.sendSlackNotification(emailDoc, slackWebhookUrl)
          .then(() => {
            result.slackSuccess = true;
            console.log(`✅ Slack notification sent for email: ${emailDoc.id}`);
          })
          .catch((error) => {
            result.errors.push(`Slack: ${error.message}`);
            console.error(`❌ Slack notification failed for ${emailDoc.id}:`, error.message);
          })
      );
    }

    if (webhookSiteUrl) {
      promises.push(
        this.sendWebhookNotification(emailDoc, webhookSiteUrl)
          .then(() => {
            result.webhookSuccess = true;
            console.log(`✅ Webhook notification sent for email: ${emailDoc.id}`);
          })
          .catch((error) => {
            result.errors.push(`Webhook: ${error.message}`);
            console.error(`❌ Webhook notification failed for ${emailDoc.id}:`, error.message);
          })
      );
    }

    // Wait for all notifications to complete
    await Promise.allSettled(promises);

    // Determine overall success
    result.success = result.slackSuccess || result.webhookSuccess;

    if (result.success) {
      console.log(`✅ Notification completed for email: ${emailDoc.id}`);
    } else {
      console.error(`❌ All notifications failed for email: ${emailDoc.id}`);
    }

    return result;
  }

  /**
   * Send Slack notification with retry logic
   */
  private async sendSlackNotification(emailDoc: EmailDocument, webhookUrl: string): Promise<void> {
    const message = this.buildSlackMessage(emailDoc);
    
    await this.sendWithRetry(
      () => this.postToSlack(webhookUrl, message),
      'Slack notification'
    );
  }

  /**
   * Send webhook.site notification with retry logic
   */
  private async sendWebhookNotification(emailDoc: EmailDocument, webhookUrl: string): Promise<void> {
    const payload = this.buildWebhookPayload(emailDoc);
    
    await this.sendWithRetry(
      () => this.postToWebhook(webhookUrl, payload),
      'Webhook notification'
    );
  }

  /**
   * Build Slack message with rich formatting
   */
  private buildSlackMessage(emailDoc: EmailDocument): SlackMessage {
    const confidence = emailDoc.aiConfidence ? `${(emailDoc.aiConfidence * 100).toFixed(1)}%` : 'N/A';
    
    return {
      text: `🎯 New Interested Email Detected!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 New Interested Email Detected!'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*From:*\n${emailDoc.from}`
            },
            {
              type: 'mrkdwn',
              text: `*Subject:*\n${emailDoc.subject}`
            },
            {
              type: 'mrkdwn',
              text: `*Confidence:*\n${confidence}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${emailDoc.date.toLocaleString()}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*AI Reasoning:*\n${emailDoc.aiReasoning || 'No reasoning provided'}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Email Preview:*\n${emailDoc.body.substring(0, 500)}${emailDoc.body.length > 500 ? '...' : ''}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Email ID: ${emailDoc.id} | Account: ${emailDoc.accountId}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build webhook payload
   */
  private buildWebhookPayload(emailDoc: EmailDocument): WebhookPayload {
    return {
      emailId: emailDoc.id,
      accountId: emailDoc.accountId,
      subject: emailDoc.subject,
      from: emailDoc.from,
      to: emailDoc.to,
      body: emailDoc.body,
      aiCategory: emailDoc.aiCategory || 'Unknown',
      aiConfidence: emailDoc.aiConfidence || 0,
      aiReasoning: emailDoc.aiReasoning || 'No reasoning provided',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send HTTP request with retry logic
   */
  private async sendWithRetry<T>(
    requestFn: () => Promise<T>,
    operationName: string,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      console.error(`❌ ${operationName} failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`⏳ Retrying ${operationName} in ${delay}ms...`);
        
        await this.sleep(delay);
        return this.sendWithRetry(requestFn, operationName, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error.response?.status;
    const message = error.message?.toLowerCase() || '';
    
    return (
      status >= 500 || // Server errors
      status === 408 || // Timeout
      status === 429 || // Rate limit
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
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
   * Post message to Slack webhook
   */
  private async postToSlack(webhookUrl: string, message: SlackMessage): Promise<AxiosResponse> {
    return axios.post(webhookUrl, message, {
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Post payload to webhook.site
   */
  private async postToWebhook(webhookUrl: string, payload: WebhookPayload): Promise<AxiosResponse> {
    return axios.post(webhookUrl, payload, {
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Test notification endpoints
   */
  async testNotifications(): Promise<{ slack: boolean; webhook: boolean }> {
    const testEmail: EmailDocument = {
      id: 'test-notification',
      accountId: 'test-account',
      messageId: 'test-message-id',
      subject: 'Test Notification - Interested Email',
      from: 'test@example.com',
      to: ['recipient@example.com'],
      date: new Date(),
      body: 'This is a test email to verify notification functionality.',
      flags: [],
      uid: 1,
      folder: 'INBOX',
      indexedAt: new Date(),
      aiCategory: 'Interested',
      aiConfidence: 0.95,
      aiReasoning: 'Test notification for system verification'
    };

    const result = await this.notifyInterested(testEmail);
    
    return {
      slack: result.slackSuccess,
      webhook: result.webhookSuccess
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export { NotificationService };
