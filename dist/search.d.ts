import { Client } from '@elastic/elasticsearch';
declare const esClient: Client;
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
export declare function indexEmail(emailDoc: EmailDocument): Promise<void>;
export declare function searchEmails(accountId: string, query: string, from?: number, size?: number): Promise<{
    hits: EmailDocument[];
    total: number;
}>;
export { esClient };
//# sourceMappingURL=search.d.ts.map