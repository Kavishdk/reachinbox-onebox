"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const replySuggestion_1 = require("./replySuggestion");
const search_1 = require("./search");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.get('/api/emails', (req, res) => {
    res.json({
        message: 'Emails endpoint - ready for implementation',
        timestamp: new Date().toISOString()
    });
});
app.get('/api/emails/search', async (req, res) => {
    try {
        const { q: query, account, folder } = req.query;
        // For now, use a default account if none provided
        const accountId = account || 'default-account';
        const results = await (0, search_1.searchEmails)(accountId, query || '', 0, 50);
        res.json(results);
    }
    catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Failed to search emails',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Reply suggestion endpoint
app.post('/api/emails/:id/suggest-reply', async (req, res) => {
    try {
        const { id: emailId } = req.params;
        const { accountId } = req.body;
        if (!accountId) {
            return res.status(400).json({
                error: 'accountId is required in request body'
            });
        }
        const suggestion = await replySuggestion_1.replySuggestionService.suggestReply(emailId, accountId);
        res.json(suggestion);
    }
    catch (error) {
        console.error('Reply suggestion error:', error);
        res.status(500).json({
            error: 'Failed to generate reply suggestion',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 ReachInbox server running on port ${PORT}`);
    console.log(`📧 Email endpoints available at:`);
    console.log(`   GET /api/emails`);
    console.log(`   GET /api/emails/search`);
    console.log(`   POST /api/emails/:id/suggest-reply`);
    console.log(`🏥 Health check at /health`);
});
exports.default = app;
//# sourceMappingURL=index.js.map