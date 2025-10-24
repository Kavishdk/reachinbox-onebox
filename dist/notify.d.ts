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
declare class NotificationService {
    private readonly MAX_RETRIES;
    private readonly INITIAL_DELAY;
    private readonly MAX_DELAY;
    private readonly TIMEOUT;
    /**
     * Notify about interested emails via Slack and webhook.site
     */
    notifyInterested(emailDoc: EmailDocument): Promise<NotificationResult>;
    /**
     * Send Slack notification with retry logic
     */
    private sendSlackNotification;
    /**
     * Send webhook.site notification with retry logic
     */
    private sendWebhookNotification;
    /**
     * Build Slack message with rich formatting
     */
    private buildSlackMessage;
    /**
     * Build webhook payload
     */
    private buildWebhookPayload;
    /**
     * Send HTTP request with retry logic
     */
    private sendWithRetry;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay;
    /**
     * Sleep utility function
     */
    private sleep;
    /**
     * Post message to Slack webhook
     */
    private postToSlack;
    /**
     * Post payload to webhook.site
     */
    private postToWebhook;
    /**
     * Test notification endpoints
     */
    testNotifications(): Promise<{
        slack: boolean;
        webhook: boolean;
    }>;
}
export declare const notificationService: NotificationService;
export { NotificationService };
//# sourceMappingURL=notify.d.ts.map