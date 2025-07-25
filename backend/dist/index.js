"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const generative_ai_1 = require("@google/generative-ai");
const express_rate_limit_1 = __importDefault(require("express-rate-limit")); // For rate limiting
const helmet_1 = __importDefault(require("helmet")); // For security headers
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// --- Security and Middleware ---
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, helmet_1.default)()); // Add security headers
// Rate limiting to prevent abuse
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});
// --- Google Gemini API Setup ---
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL ERROR: GEMINI_API_KEY is not defined. Please set it in your .env file.');
    process.exit(1); // Exit if API key is missing
}
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// --- Routes ---
app.post('/chat', apiLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { message } = req.body;
        // Input validation
        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }
        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message must be a non-empty string.' });
        }
        // Optional: Add a max length check for the message
        const MAX_MESSAGE_LENGTH = 1000;
        if (message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.` });
        }
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = yield model.generateContent(message);
        const response = yield result.response;
        const text = response.text();
        res.json({ response: text });
    }
    catch (error) {
        console.error('Error calling Gemini API:', error); // Log the full error for server-side debugging
        // You might want to categorize errors here (e.g., API errors vs. internal errors)
        res.status(500).json({ error: 'Failed to get response from AI. Please try again later.' });
    }
}));
// --- Server Startup ---
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
