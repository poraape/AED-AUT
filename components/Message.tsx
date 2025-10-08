import React from 'react';
import type { ChatMessage } from '../types';
import AnalysisDisplay from './AnalysisDisplay';
import { SparklesIcon } from './icons/SparklesIcon';
import Spinner from './Spinner';
import { WarningIcon } from './icons/WarningIcon';

interface MessageProps {
  message: ChatMessage;
  showSummary?: boolean;
  onSuggestionClick?: (question: string) => void;
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

const Message: React.FC<MessageProps> = ({ message, showSummary = false, onSuggestionClick, onDrillDown }) => {
  const isAgent = message.sender === 'agent';
  const isError = message.isError;
  
  // A simple markdown-to-html converter
  const renderText = (text: string) => {
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\n/g, '<br />'); // Newlines
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className={`flex items-start gap-4 ${isAgent ? '' : 'flex-row-reverse'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isAgent 
          ? isError ? 'bg-red-500' : 'bg-indigo-500' 
          : 'bg-gray-600'
      }`}>
        {isAgent ? (
            isError ? <WarningIcon className="w-5 h-5 text-white" /> : <SparklesIcon className="w-5 h-5 text-white" />
        ) : <span className="text-sm font-semibold">U</span>}
      </div>
      <div className={`w-full max-w-2xl px-5 py-4 rounded-lg shadow ${
        isAgent 
          ? isError ? 'bg-gray-700 border border-red-500/50' : 'bg-gray-700'
          : 'bg-blue-600 text-white'
      }`}>
        {message.isTyping && !message.content.analysisResult ? (
          <div className="flex items-center space-x-2">
            <Spinner />
            <span>Analisando...</span>
          </div>
        ) : (
          <>
            <div className={`prose prose-invert prose-sm max-w-none ${isError ? 'text-red-300' : ''}`}>
              {renderText(message.content.text)}
            </div>
            {message.content.analysisResult && (
              <div className="mt-4">
                <AnalysisDisplay 
                  result={message.content.analysisResult} 
                  messageId={message.id} 
                  showSummary={showSummary} 
                  onQuestionSelect={onSuggestionClick}
                  onDrillDown={onDrillDown}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Message;