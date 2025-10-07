import React, { useState } from 'react';
import FileUpload from './FileUpload';
import type { PreAnalysisResult } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { SendIcon } from './icons/SendIcon';

interface PreAnalysisViewProps {
  onFileSelect?: (file: File) => void;
  preAnalysis?: PreAnalysisResult;
  onQuestionSelect?: (question: string) => void;
  fileName?: string;
}

const PreAnalysisView: React.FC<PreAnalysisViewProps> = ({ onFileSelect, preAnalysis, onQuestionSelect, fileName }) => {
  const [customQuestion, setCustomQuestion] = useState('');

  const handleSubmitCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuestion.trim() && onQuestionSelect) {
      onQuestionSelect(customQuestion.trim());
    }
  };
  
  // Mode 2: Show pre-analysis summary and suggested questions
  if (preAnalysis && onQuestionSelect && fileName) {
    return (
      <div className="w-full max-w-3xl text-left animate-fade-in">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <PaperclipIcon className="w-5 h-5 text-gray-400" />
            <span className="text-md font-medium text-gray-200">{fileName}</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-100 mb-3">Resumo Inteligente</h2>
          <p className="text-gray-300">{preAnalysis.summary}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200 text-center">Comece a explorar com estas perguntas:</h3>
          {preAnalysis.suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuestionSelect(q)}
              className="w-full text-left bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {q}
            </button>
          ))}
        </div>
        
        <div className="mt-8">
            <p className="text-center text-gray-400 text-sm mb-4">Ou faça sua própria pergunta para iniciar a análise</p>
            <form onSubmit={handleSubmitCustomQuestion} className="flex items-center gap-3">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Ex: Qual a correlação entre vendas e publicidade?"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Faça sua própria pergunta de análise"
                />
                <button
                    type="submit"
                    disabled={!customQuestion.trim()}
                    className="bg-indigo-600 text-white rounded-lg p-2.5 hover:bg-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
                    aria-label="Iniciar análise com pergunta customizada"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </form>
        </div>

      </div>
    );
  }
  
  // Mode 1: Show file upload
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h1 className="text-4xl font-bold text-gray-100 mb-2">Análise Exploratória de Dados Automatizada</h1>
      <p className="text-lg text-gray-400 max-w-2xl mb-10">
        Obtenha insights instantâneos do seu conjunto de dados. Nossa IA irá realizar uma análise completa, 
        identificar padrões e criar visualizações para você.
      </p>
      {onFileSelect && <FileUpload onFileSelect={onFileSelect} />}
    </div>
  );
};

export default PreAnalysisView;