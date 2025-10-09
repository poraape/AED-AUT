

import React, { useState } from 'react';
// FIX: Import DataProfile type.
import type { ChatMessage, DataProfile } from '../types';
import AnalysisDisplay from './AnalysisDisplay';
import { SparklesIcon } from './icons/SparklesIcon';
import Spinner from './Spinner';
import { WarningIcon } from './icons/WarningIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import TypingEffect from './TypingEffect';

interface MessageProps {
  message: ChatMessage;
  // FIX: Add dataProfile to props to pass to AnalysisDisplay.
  dataProfile?: DataProfile;
  showSummary?: boolean;
  onSuggestionClick?: (question: string) => void;
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

const Message: React.FC<MessageProps> = ({ message, dataProfile, showSummary = false, onSuggestionClick, onDrillDown }) => {
  const isAgent = message.sender === 'agent';
  const isError = message.isError;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (isCopied) return;
    
    let textToCopy = message.content.text;
    if (message.content.analysisResult?.findings) {
        const insights = message.content.analysisResult.findings.map(f => f.insight).join('\n\n');
        textToCopy += `\n\n**Principais Achados:**\n${insights}`;
    }

    navigator.clipboard.writeText(textToCopy.replace(/\*\*/g, ''));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const renderUserText = (text: string) => {
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
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
      <div className={`relative group w-full max-w-2xl px-5 py-4 rounded-lg shadow ${
        isAgent 
          ? isError ? 'bg-gray-700 border border-red-500/50' : 'bg-gray-700'
          : 'bg-indigo-600 text-white'
      }`}>
        {isAgent && !message.isTyping && message.content.text && (
            <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-800/60 text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Copiar mensagem"
            >
                {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
            </button>
        )}
        
        {message.isTyping && !message.content.analysisResult ? (
          <div className="flex items-center space-x-2">
            <Spinner />
            <span>Analisando...</span>
          </div>
        ) : (
          <>
            <div className={`prose prose-invert prose-sm max-w-none ${isError ? 'text-red-300' : ''}`}>
               {isAgent && !isError ? (
                 <TypingEffect text={message.content.text} />
               ) : (
                 renderUserText(message.content.text)
               )}
            </div>
            {message.content.analysisResult && (
              <div className="mt-4">
                <AnalysisDisplay 
                  result={message.content.analysisResult} 
                  messageId={message.id} 
                  showSummary={showSummary} 
                  dataProfile={dataProfile}
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
