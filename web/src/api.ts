import axios from 'axios';

export interface Email {
  id: string;
  accountId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
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
  indexedAt: string;
  aiCategory?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  classifiedAt?: string;
}

export interface SearchParams {
  q?: string;
  account?: string;
  folder?: string;
}

export interface SearchResponse {
  hits: Email[];
  total: number;
}

class EmailAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = '/api';
  }

  async searchEmails(params: SearchParams): Promise<SearchResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.q) queryParams.append('q', params.q);
      if (params.account) queryParams.append('account', params.account);
      if (params.folder) queryParams.append('folder', params.folder);

      const response = await axios.get(`${this.baseURL}/emails/search?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Failed to search emails:', error);
      throw error;
    }
  }

  async getEmails(): Promise<Email[]> {
    try {
      const response = await axios.get(`${this.baseURL}/emails`);
      return response.data;
    } catch (error) {
      console.error('Failed to get emails:', error);
      throw error;
    }
  }
}

export const emailAPI = new EmailAPI();
