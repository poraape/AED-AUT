// FIX: Implement the main App component to manage state and application flow.
import React, { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, DataProfile, PreAnalysisResult } from './types';
import Header from './components/Header';
import PreAnalysisView from './components/PreAnalysisView';
import ChatInterface from './components/ChatInterface';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorDisplay from './components/ErrorDisplay';
import { getPreAnalysis, getAnalysis } from './services/geminiService';
import { profileData } from './services/dataProfiler';
import { getChatHistory, saveChatHistory, removeChatHistory } from './services/dbService';

type AppState = 'PRE_ANALYSIS' | 'LOADING' | 'CHAT' | 'ERROR';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('PRE_ANALYSIS');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [csvData, setCsvData] = useState<string>('');
  const [dataProfile, setDataProfile] = useState<DataProfile | null>(null);
  const [preAnalysis, setPreAnalysis] = useState<PreAnalysisResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const getHistoryKey = useCallback(() => `chatHistory_${fileName}`, [fileName]);

  useEffect(() => {
    if (fileName && messages.length > 0) {
      saveChatHistory(getHistoryKey(), messages);
    }
  }, [messages, fileName, getHistoryKey]);

  const resetState = useCallback(() => {
    if (fileName) {
      removeChatHistory(getHistoryKey());
    }
    setAppState('PRE_ANALYSIS');
    setFile(null);
    setFileName('');
    setCsvData('');
    setDataProfile(null);
    setPreAnalysis(null);
    setMessages([]);
    setIsProcessing(false);
    setError(null);
  }, [fileName, getHistoryKey]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Reset previous state before processing a new file
    resetState();
    setFileName(selectedFile.name);
    setAppState('LOADING');
    
    try {
      const text = await selectedFile.text();
      setCsvData(text);

      const { profile } = profileData(text);
      setDataProfile(profile);

      const historyKey = `chatHistory_${selectedFile.name}`;
      const savedHistory = getChatHistory(historyKey);
      if (savedHistory && savedHistory.length > 0) {
        setMessages(savedHistory);
        setAppState('CHAT');
        return;
      }
      
      const sampleData = text.split('\n').slice(0, 20).join('\n');
      const preAnalysisResult = await getPreAnalysis(profile, sampleData);
      setPreAnalysis(preAnalysisResult);
      setAppState('PRE_ANALYSIS');
      // Set file *after* pre-analysis is done to show the pre-analysis view
      setFile(selectedFile);

    } catch (e: any) {
      console.error(e);
      setError({
        title: e.title || 'Erro ao Processar Arquivo',
        message: e.message || 'Houve um problema ao ler ou analisar seu arquivo. Verifique se é um CSV válido e tente novamente.',
      });
      setAppState('ERROR');
    }
  }, [resetState]);

  const handleSendMessage = useCallback(async (question: string) => {
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user-${Math.random()}`,
      sender: 'user',
      content: { text: question },
    };
    
    const currentMessages = messages.filter(m => !m.isTyping);
    setMessages([...currentMessages, userMessage]);
    setAppState('CHAT');
    setIsProcessing(true);

    const agentTypingMessage: ChatMessage = {
      id: `${Date.now()}-agent-${Math.random()}`,
      sender: 'agent',
      content: { text: '' },
      isTyping: true,
    };
    setMessages(prev => [...prev, agentTypingMessage]);

    try {
      // FIX: Explicitly type `chatHistoryForApi` to prevent the compiler from widening the `role` property to `string`.
      // This ensures it matches the type expected by the `getAnalysis` function.
      const chatHistoryForApi: { role: 'user' | 'model'; parts: { text: string }[] }[] = [...currentMessages, userMessage]
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content.text + (msg.content.analysisResult ? JSON.stringify(msg.content.analysisResult) : '') }]
        }));

      const dataSample = csvData.split('\n').slice(0, 200).join('\n');

      const analysisResult = await getAnalysis(dataProfile!, dataSample, question, chatHistoryForApi);

      const agentResponseMessage: ChatMessage = {
        id: agentTypingMessage.id,
        sender: 'agent',
        content: {
          text: `Aqui está a análise para sua pergunta:`,
          analysisResult: analysisResult,
        },
      };

      setMessages(prev => prev.map(m => m.id === agentTypingMessage.id ? agentResponseMessage : m));

    } catch (e: any) {
      console.error(e);
      const errorMessage: ChatMessage = {
        id: agentTypingMessage.id,
        sender: 'agent',
        isError: true,
        content: {
            text: e.message || "Desculpe, não consegui processar sua solicitação. Por favor, tente novamente."
        },
      };
      setMessages(prev => prev.map(m => m.id === agentTypingMessage.id ? errorMessage : m));
    } finally {
      setIsProcessing(false);
    }
  }, [messages, csvData, dataProfile]);

  const handleDrillDown = useCallback((chartTitle: string, dataPoint: Record<string, any>) => {
    const question = `Poderia me dar mais detalhes sobre este ponto de dados do gráfico "${chartTitle}"? Dados: ${JSON.stringify(dataPoint)}`;
    handleSendMessage(question);
  }, [handleSendMessage]);

  const renderContent = () => {
    switch (appState) {
      case 'LOADING':
        return <LoadingIndicator text="Analisando seu arquivo..." />;
      case 'ERROR':
        return <ErrorDisplay title={error!.title} message={error!.message} onRetry={resetState} />;
      case 'CHAT':
        return (
          <ChatInterface 
            messages={messages}
            dataProfile={dataProfile!}
            fileName={fileName}
            onSendMessage={handleSendMessage}
            onDrillDown={handleDrillDown}
            onReset={resetState}
            isProcessing={isProcessing}
          />
        );
      case 'PRE_ANALYSIS':
      default:
        return (
          <PreAnalysisView 
            onFileSelect={file ? undefined : handleFileSelect}
            preAnalysis={preAnalysis!}
            onQuestionSelect={handleSendMessage}
            fileName={fileName}
          />
        );
    }
  };

  return (
    <div className="bg-gray-900 text-gray-200 font-sans h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;