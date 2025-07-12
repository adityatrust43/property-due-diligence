import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import rateLimit from 'express-rate-limit'; // For rate limiting
import helmet from 'helmet'; // For security headers

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// --- Security and Middleware ---
app.use(cors());
app.use(express.json());
app.use(helmet()); // Add security headers

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Routes ---
app.post('/chat', apiLimiter, async (req, res) => { // Apply rate limiter specifically to the /chat route
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
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error); // Log the full error for server-side debugging
    // You might want to categorize errors here (e.g., API errors vs. internal errors)
    res.status(500).json({ error: 'Failed to get response from AI. Please try again later.' });
  }
});

// --- Server Startup ---
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
