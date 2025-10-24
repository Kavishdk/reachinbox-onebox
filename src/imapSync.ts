import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { indexEmail, EmailDocument } from './search';
import { emailClassifier, ClassificationRequest } from './classifier';

export interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port?: number;
  tls?: boolean;
  tlsOptions?: any;
  keepalive?: {
    interval?: number;
    idleInterval?: number;
    forceNoop?: boolean;
  };
}

export interface ImapAccount {
  id: string;
  config: ImapConfig;
  connection?: Imap;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  watchdogTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
}

class ImapSyncManager {
  private accounts: Map<string, ImapAccount> = new Map();
  private readonly WATCHDOG_INTERVAL = 29 * 60 * 1000; // 29 minutes
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly INITIAL_RECONNECT_DELAY = 1000; // 1 second

  async startImap(accountId: string, config: ImapConfig): Promise<void> {
    console.log(`🚀 Starting IMAP sync for account: ${accountId}`);
    
    const account: ImapAccount = {
      id: accountId,
      config: {
        ...config,
        keepalive: {
          interval: 10000, // 10 seconds
          idleInterval: 300000, // 5 minutes
          forceNoop: true,
          ...config.keepalive
        }
      },
      isConnected: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: this.INITIAL_RECONNECT_DELAY
    };

    this.accounts.set(accountId, account);
    await this.connectAccount(account);
  }

  private async connectAccount(account: ImapAccount): Promise<void> {
    try {
      console.log(`🔌 Connecting to IMAP server for account: ${account.id}`);
      
      const imap = new Imap({
        user: account.config.user,
        password: account.config.password,
        host: account.config.host,
        port: account.config.port || 993,
        tls: account.config.tls !== false,
        tlsOptions: account.config.tlsOptions || {},
        keepalive: account.config.keepalive
      });

      account.connection = imap;
      
      // Set up event handlers
      this.setupEventHandlers(account);
      
      // Connect
      imap.connect();
      
    } catch (error) {
      console.error(`❌ Failed to create IMAP connection for ${account.id}:`, error);
      await this.handleReconnect(account);
    }
  }

  private setupEventHandlers(account: ImapAccount): void {
    const imap = account.connection!;

    imap.once('ready', () => {
      console.log(`✅ IMAP connection ready for account: ${account.id}`);
      account.isConnected = true;
      account.reconnectAttempts = 0;
      account.reconnectDelay = this.INITIAL_RECONNECT_DELAY;
      
      this.startWatchdog(account);
      this.startIdleMonitoring(account);
    });

    imap.once('error', (err: Error) => {
      console.error(`❌ IMAP error for account ${account.id}:`, err);
      account.isConnected = false;
      this.handleReconnect(account);
    });

    imap.once('end', () => {
      console.log(`🔌 IMAP connection ended for account: ${account.id}`);
      account.isConnected = false;
      this.cleanupTimers(account);
    });

    imap.on('mail', () => {
      console.log(`📧 New mail detected for account: ${account.id}`);
      this.fetchNewEmails(account);
    });

    imap.on('expunge', (seqno: number) => {
      console.log(`🗑️ Email expunged for account ${account.id}, seqno: ${seqno}`);
    });
  }

  private async startWatchdog(account: ImapAccount): Promise<void> {
    account.watchdogTimer = setInterval(() => {
      if (account.isConnected && account.connection) {
        console.log(`🐕 Watchdog NOOP for account: ${account.id}`);
        // imap typings may not expose noop, use any cast to be resilient
        (account.connection as any).noop((err: any) => {
          if (err) {
            console.error(`❌ Watchdog NOOP failed for ${account.id}:`, err);
            account.isConnected = false;
            this.handleReconnect(account);
          }
        });
      }
    }, this.WATCHDOG_INTERVAL);
  }

  private startIdleMonitoring(account: ImapAccount): void {
    if (!account.isConnected || !account.connection) return;

    console.log(`🔄 Starting IDLE monitoring for account: ${account.id}`);
    
    account.connection.openBox('INBOX', true, (err, box) => {
      if (err) {
        console.error(`❌ Failed to open INBOX for ${account.id}:`, err);
        return;
      }

      console.log(`📁 INBOX opened for account ${account.id}, ${box.messages.total} messages`);
      
      // Start IDLE (some imap libs expose idle via non-typed methods)
      (account.connection as any).idle();
    });
  }

  private async fetchNewEmails(account: ImapAccount): Promise<void> {
    if (!account.isConnected || !account.connection) return;

    try {
  // Stop IDLE to fetch emails (use any cast in case types differ)
  (account.connection as any).idleStop();
      
      // Get recent emails (last 10)
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = {
        bodies: '',
        struct: true,
        markSeen: false
      };

  (account.connection as any).search(searchCriteria, (err: any, results: any) => {
        if (err) {
          console.error(`❌ Search failed for ${account.id}:`, err);
          this.restartIdle(account);
          return;
        }

        if (results && results.length > 0) {
          console.log(`📬 Found ${results.length} new emails for account: ${account.id}`);
          
          const fetch = (account.connection as any).fetch(results.slice(-10), fetchOptions);
          
          fetch.on('message', (msg: any, seqno: any) => {
            let buffer = '';

            msg.on('body', (stream: any) => {
              stream.on('data', (chunk: any) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', () => {
                this.processEmail(buffer, account, seqno);
              });
            });
          });

          fetch.once('error', (err: any) => {
            console.error(`❌ Fetch error for ${account.id}:`, err);
          });

          fetch.once('end', () => {
            console.log(`✅ Finished fetching emails for account: ${account.id}`);
            this.restartIdle(account);
          });
        } else {
          this.restartIdle(account);
        }
      });

    } catch (error) {
      console.error(`❌ Error fetching emails for ${account.id}:`, error);
      this.restartIdle(account);
    }
  }

  private async processEmail(rawEmail: string, account: ImapAccount, seqno: number): Promise<void> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail);

      // Helper to normalize address fields into string arrays
      const toArray = (addr: any): string[] => {
        if (!addr) return [];
        if (Array.isArray(addr)) return addr.map(a => a?.text || a?.address).filter(Boolean);
        return [(addr as any).text || (addr as any).address].filter(Boolean);
      };

      const to = toArray(parsed.to);
      const cc = toArray(parsed.cc);
      const bcc = toArray(parsed.bcc);

      const emailDoc: EmailDocument = {
        id: `${account.id}-${parsed.messageId || seqno}`,
        accountId: account.id,
        messageId: parsed.messageId || '',
        subject: parsed.subject || 'No Subject',
        from: parsed.from?.text || '',
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        date: parsed.date || new Date(),
        body: parsed.text || '',
        htmlBody: typeof parsed.html === 'string' ? parsed.html : undefined,
        attachments: parsed.attachments?.map(att => ({
          filename: att.filename || 'unknown',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0
        })),
        flags: [],
        uid: seqno,
        folder: 'INBOX',
        indexedAt: new Date()
      };

      await indexEmail(emailDoc);
      
      // Classify the email
      try {
        const classificationRequest: ClassificationRequest = {
          emailId: emailDoc.id,
          accountId: emailDoc.accountId,
          subject: emailDoc.subject,
          body: emailDoc.body,
          from: emailDoc.from,
          to: emailDoc.to
        };
        
        await emailClassifier.classifyAndUpdateEmail(classificationRequest);
      } catch (error) {
        console.error(`❌ Failed to classify email ${emailDoc.id}:`, error);
        // Continue processing other emails even if classification fails
      }
      
    } catch (error) {
      console.error(`❌ Failed to process email for ${account.id}:`, error);
    }
  }

  private restartIdle(account: ImapAccount): void {
    if (!account.isConnected || !account.connection) return;

    setTimeout(() => {
      if (account.isConnected && account.connection) {
        console.log(`🔄 Restarting IDLE for account: ${account.id}`);
        (account.connection as any).idle();
      }
    }, 1000);
  }

  private async handleReconnect(account: ImapAccount): Promise<void> {
    if (account.reconnectAttempts >= account.maxReconnectAttempts) {
      console.error(`❌ Max reconnect attempts reached for account: ${account.id}`);
      return;
    }

    account.reconnectAttempts++;
    const delay = account.reconnectDelay * Math.pow(2, account.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting account ${account.id} in ${delay}ms (attempt ${account.reconnectAttempts})`);
    
    this.cleanupTimers(account);
    
    setTimeout(async () => {
      await this.connectAccount(account);
    }, delay);
  }

  private cleanupTimers(account: ImapAccount): void {
    if (account.watchdogTimer) {
      clearInterval(account.watchdogTimer);
      account.watchdogTimer = undefined;
    }
    
    if (account.idleTimer) {
      clearTimeout(account.idleTimer);
      account.idleTimer = undefined;
    }
  }

  async stopImap(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    console.log(`🛑 Stopping IMAP sync for account: ${accountId}`);
    
    this.cleanupTimers(account);
    
    if (account.connection && account.isConnected) {
      account.connection.end();
    }
    
    this.accounts.delete(accountId);
  }

  async stopAll(): Promise<void> {
    console.log(`🛑 Stopping all IMAP connections`);
    
    const promises = Array.from(this.accounts.keys()).map(accountId => 
      this.stopImap(accountId)
    );
    
    await Promise.all(promises);
  }

  getAccountStatus(accountId: string): { isConnected: boolean; reconnectAttempts: number } | null {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    
    return {
      isConnected: account.isConnected,
      reconnectAttempts: account.reconnectAttempts
    };
  }
}

// Export singleton instance
export const imapSyncManager = new ImapSyncManager();
export { ImapSyncManager };
