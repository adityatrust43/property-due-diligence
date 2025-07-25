# **App Name**: Gemini Chat UI

## Core Features:

- Welcome Message: Display initial welcome message: "Welcome to AI Studio".
- Chat History Display: Render conversation history with user prompts and AI responses.
- Prompt Input: Provide a text input area at the bottom for typing prompts.
- Prompt Submission: Implement 'Run' button with Ctrl+Enter keyboard shortcut for prompt submission.
- Prompt Transmission: Securely send prompt from frontend to a Firebase Cloud Function.
- Gemini API Interaction: Call the Google Gemini API using the prompt. This tool may decide to incorporate code into its response if the prompt contains coding related questions.
- AI Response Display: Display Gemini API responses in the chat window.

## Style Guidelines:

- Background color: Dark gray (#202124) to maintain a dark mode interface.
- Primary text color: Light gray (#D1D5DB) for readability against the dark background.
- Accent color: Distinct blue (#4285F4) for highlighting UI elements like the title and interactive components.
- Body and headline font: 'Inter' (sans-serif) for a modern, clean interface.
- Use a set of simple, outlined icons for actions like copy, share, undo, redo, etc.
- Use a fixed header at the top with the title and icons. Main content area displays chat history, and a fixed input field at the bottom.
- Subtle animations when sending and receiving messages.