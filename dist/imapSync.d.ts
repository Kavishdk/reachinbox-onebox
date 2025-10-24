import Imap from 'imap';
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
declare class ImapSyncManager {
    private accounts;
    private readonly WATCHDOG_INTERVAL;
    private readonly IDLE_TIMEOUT;
    private readonly MAX_RECONNECT_ATTEMPTS;
    private readonly INITIAL_RECONNECT_DELAY;
    startImap(accountId: string, config: ImapConfig): Promise<void>;
    private connectAccount;
    private setupEventHandlers;
    private startWatchdog;
    private startIdleMonitoring;
    private fetchNewEmails;
    private processEmail;
    private restartIdle;
    private handleReconnect;
    private cleanupTimers;
    stopImap(accountId: string): Promise<void>;
    stopAll(): Promise<void>;
    getAccountStatus(accountId: string): {
        isConnected: boolean;
        reconnectAttempts: number;
    } | null;
}
export declare const imapSyncManager: ImapSyncManager;
export { ImapSyncManager };
//# sourceMappingURL=imapSync.d.ts.map