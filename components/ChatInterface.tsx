// FIX: Implement ChatInterface component to display conversation and handle user input.
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, DataProfile } from '../types';
import Message from './Message';
import { SendIcon } from './icons/SendIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { TrashIcon } from './icons/TrashIcon';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  dataProfile?: DataProfile;
  fileName: string;
  onSendMessage: (message: string) => void;
  onDrillDown: (chartTitle: string, dataPoint: Record<string, any>) => void;
  onReset: () => void;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, dataProfile, fileName, onSendMessage, onDrillDown, onReset, isProcessing }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };
  
  const handleSuggestionClick = (question: string) => {
      handleSendMessage(question);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 w-full">
      <header className="flex-shrink-0 bg-gray-900/50 backdrop-blur-md border-b border-gray-700 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 overflow-hidden">
            <PaperclipIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="font-medium text-gray-200 truncate">{fileName}</span>
          </div>
          <button 
            onClick={onReset} 
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            aria-label="Iniciar nova análise"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Nova Análise</span>
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((msg, index) => (
            <Message
              key={msg.id}
              message={msg}
              dataProfile={dataProfile}
              // FIX: Only show summary for the first agent message.
              showSummary={index === 0 && msg.sender === 'agent'}
              onSuggestionClick={handleSuggestionClick}
              onDrillDown={onDrillDown}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="flex-shrink-0 bg-gray-900/50 backdrop-blur-md border-t border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isProcessing ? "Aguarde a análise..." : "Faça uma pergunta sobre seus dados..."}
              disabled={isProcessing}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-4 pr-14 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Caixa de entrada de mensagem"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white rounded-md p-2 hover:bg-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
              aria-label="Enviar mensagem"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};

export default ChatInterface;
