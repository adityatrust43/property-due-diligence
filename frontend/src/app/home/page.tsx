"use client";

import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' as const };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = { text: data.response, sender: 'bot' as const };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: 'Error: Could not get a response.', sender: 'bot' as const },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <span className="font-semibold text-lg">ChatGPT</span>
          <svg className="w-4 h-4 ml-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 rounded-md bg-black text-white text-sm font-medium">Log in</button>
          <button className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 text-sm font-medium">Sign up for free</button>
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
      </header>

      {/* Main Content - Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col items-center">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold mb-8">ChatGPT</h1>
            {/* Suggestion Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mt-8 max-w-2xl">
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-full text-gray-700 text-sm hover:bg-gray-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                Analyze images
              </button>
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-full text-gray-700 text-sm hover:bg-gray-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Surprise me
              </button>
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-full text-gray-700 text-sm hover:bg-gray-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Summarize text
              </button>
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-full text-gray-700 text-sm hover:bg-gray-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                Help me write
              </button>
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-full text-gray-700 text-sm hover:bg-gray-50">
                More
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                  Typing...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 flex flex-col items-center">
        <div className="w-full max-w-2xl relative">
          <div className="relative flex items-center border border-gray-300 rounded-xl shadow-lg p-2">
            <input
              type="text"
              className="flex-1 p-2 pl-4 pr-10 rounded-xl focus:outline-none text-lg"
              placeholder="Ask anything"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <div className="absolute right-4 flex items-center space-x-2">
              <button className="flex items-center text-gray-600 text-sm px-3 py-1 rounded-full hover:bg-gray-100">
                <Image src="/file.svg" alt="Attach" width={16} height={16} className="mr-1" />
                Attach
              </button>
              <button className="flex items-center text-gray-600 text-sm px-3 py-1 rounded-full hover:bg-gray-100">
                <Image src="/globe.svg" alt="Search" width={16} height={16} className="mr-1" />
                Search
              </button>
            </div>
          </div>
          <button className="absolute right-1/2 transform translate-x-1/2 -bottom-14 bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm flex items-center">
            <Image src="/window.svg" alt="Voice" width={16} height={16} className="mr-1" />
            Voice
          </button>
        </div>
      </div>
    </div>
  );
}
