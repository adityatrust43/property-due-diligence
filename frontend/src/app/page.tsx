'use client';

import { Button } from '../components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Property Document Analyzer</h1>
      <p className="text-lg mb-8">Your AI-powered assistant for property documents</p>
      <div className="flex space-x-4">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
          onClick={() => (window.location.href = '/chat')}
        >
          Chat with AI
        </Button>
        <Button
          className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg text-lg"
          onClick={() => {
            alert('This feature is not yet implemented.');
          }}
        >
          Analyse Documents
        </Button>
      </div>
    </div>
  );
}
