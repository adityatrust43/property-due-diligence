'use client';

import type { Message } from '../types';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { cn } from '../lib/utils';
import { Bot, Copy, MoreVertical, Redo2, Share2, Undo2, User, CornerDownLeft } from 'lucide-react';
import React, { useRef, useState, useEffect, type FormEvent } from 'react';
import LoadingDots from './ui/loading-dots';

const ChatHeader = () => (
  <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-b border-border z-10">
    <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-foreground">
        <span className="text-primary font-bold">AI</span> Studio
      </h1>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
          <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
          <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
          <Undo2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
          <Redo2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
          <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  </header>
);

const WelcomeMessage = () => (
    <div className="flex flex-col items-center justify-center h-full pt-10 sm:pt-20 text-center">
        <div className="p-4 bg-primary/10 rounded-full mb-4">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <path d="M12.8235 4.34112L15.6588 7.17641L12.8235 9.99994M11.1765 20.2352L8.34118 17.4L11.1765 14.5647M16.5176 12.2823L7.48235 12.2823" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.02353 12.2824C4.02353 17.151 7.97176 21.1177 12.8235 21.1177C17.6753 21.1177 21.6235 17.151 21.6235 12.2824C21.6235 7.41374 17.6753 3.44708 12.8235 3.44708" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Welcome to AI Studio</h2>
        <p className="text-muted-foreground mt-2 max-w-sm">Start a conversation by typing your prompt below. You can ask anything from brainstorming ideas to generating code.</p>
    </div>
);

const ChatMessage = ({ message: { role, content } }: { message: Message }) => {
    const isUser = role === 'user';
    return (
        <div className="flex items-start gap-4 my-6 animate-in fade-in">
            <div className={cn("flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full", isUser ? 'bg-primary/10' : 'bg-muted')}>
                {isUser ? <User className="h-5 w-5 text-primary" /> : <Bot className="h-5 w-5 text-foreground" />}
            </div>
            <div className="flex-1 pt-1 prose prose-invert max-w-none text-foreground prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-blockquote:text-muted-foreground prose-code:text-primary">
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
        </div>
    )
}

const LoadingMessage = () => (
    <div className="flex items-start gap-4 my-6 animate-in fade-in">
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-muted">
            <Bot className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 pt-3">
            <LoadingDots />
        </div>
    </div>
);

const ChatMessageList = ({ messages, isLoading }: { messages: Message[], isLoading: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 w-full overflow-y-auto pt-24 pb-36 sm:pb-48">
        <div className="container mx-auto max-w-3xl px-4">
            {messages.length === 0 && !isLoading ? (
                <WelcomeMessage />
            ) : (
                messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
            )}
            {isLoading && <LoadingMessage />}
        </div>
    </div>
  )
}

const ChatInputForm = ({ input, setInput, handleSubmit, isLoading }: { input: string, setInput: (value: string) => void, handleSubmit: (e: FormEvent<HTMLFormElement>) => void, isLoading: boolean }) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (inputRef.current) {
                const form = inputRef.current.closest('form');
                if(form) handleSubmit(new Event('submit', { cancelable: true, bubbles: true }) as unknown as FormEvent<HTMLFormElement>);
            }
        }
    }
    
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            const scrollHeight = inputRef.current.scrollHeight;
            inputRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent">
            <div className="container mx-auto max-w-3xl px-4 py-4 sm:py-6">
                <form
                    onSubmit={handleSubmit}
                    className="relative"
                >
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Brainstorm 5 unique app ideas for sustainable living →"
                        disabled={isLoading}
                        rows={1}
                        className="w-full rounded-2xl border-2 border-border bg-muted py-3 sm:py-4 pl-4 sm:pl-6 pr-24 sm:pr-32 text-base resize-none focus-visible:ring-1 focus-visible:ring-primary overflow-y-auto"
                        style={{maxHeight: '200px'}}
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-lg h-9 sm:h-10 px-3 sm:px-4"
                    >
                        <span>Run</span>
                        <CornerDownLeft className="h-4 w-4 ml-2 hidden sm:inline-block" />
                    </Button>
                </form>
            </div>
        </div>
    )
}

export const ChatInterface = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch AI response');
      }

      const data = await response.json();
      const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', content: data.response };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error: any) {
      console.error('Error sending message to backend:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not connect to the backend. Please ensure the backend server is running.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <ChatHeader />
      <main className="flex-1 flex flex-col">
        <ChatMessageList messages={messages} isLoading={isLoading} />
      </main>
      <ChatInputForm input={input} setInput={setInput} handleSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  )
}
