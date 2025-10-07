
import React, { useState } from 'react';
import JSZip from 'jszip';
import type { AnalysisResult, PreAnalysisResult } from './types';
import Header from './components/Header';
import PreAnalysisView from './components/PreAnalysisView';
import ChatInterface from './components/ChatInterface';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorDisplay from './components/ErrorDisplay';
// FIX: Adding performPreAnalysis and updating performInitialAnalysis call signature
import { performInitialAnalysis, performPreAnalysis } from './services/geminiService';
import { GeminiApiError, DataParsingError } from './services/errors';

type AppState =
  | 'pre-analysis'
  | 'loading-pre-analysis'
  | 'showing_suggestions'
  | 'loading-analysis'
  | 'chat'
  | 'error';
  
interface AppError {
  title: string;
  message: string;
}

function App() {
  const [appState, setAppState] = useState<AppState>('pre-analysis');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [preAnalysisResult, setPreAnalysisResult] = useState<PreAnalysisResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  /**
   * Step 1: Handles the file upload, extracting CSV from ZIP if necessary, then triggers pre-analysis.
   */
  const handlePreAnalysis = async (file: File) => {
    setAppState('loading-pre-analysis');
    setError(null);

    try {
      let csvFile = file;

      // Check if the file is a ZIP archive
      if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        // Find the first valid CSV file, ignoring macOS metadata folders
        const csvFiles = Object.keys(zip.files).filter(filename => 
            !zip.files[filename].dir && 
            filename.toLowerCase().endsWith('.csv') && 
            !filename.startsWith('__MACOSX/')
        );
        
        if (csvFiles.length === 0) {
          throw new DataParsingError("Nenhum arquivo CSV encontrado no arquivo ZIP.", "Erro de Arquivo");
        }

        // Use the first CSV file found
        const csvFileName = csvFiles[0];
        const zipEntry = zip.file(csvFileName);
        if (!zipEntry) {
            throw new DataParsingError(`Não foi possível ler o arquivo ${csvFileName} do ZIP.`, "Erro de Arquivo");
        }

        const csvContent = await zipEntry.async('string');
        csvFile = new File([csvContent], csvFileName.split('/').pop() || 'extracted.csv', { type: 'text/csv' });

      } else if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
          throw new DataParsingError("Tipo de arquivo inválido. Por favor, envie um arquivo CSV ou um ZIP contendo um CSV.", "Erro de Upload");
      }

      setCurrentFile(csvFile);
      const result = await performPreAnalysis(csvFile);
      setPreAnalysisResult(result);
      setAppState('showing_suggestions');
      
    } catch (err) {
      console.error(err);
      let errorPayload: AppError;
       if (err instanceof GeminiApiError) {
        errorPayload = { title: "Erro de Comunicação com a IA", message: err.message };
      } else if (err instanceof DataParsingError) {
        errorPayload = { title: err.title || "Erro de Processamento", message: err.message };
      } else if (err instanceof Error) {
        errorPayload = { title: "Erro Inesperado", message: `Ocorreu um problema: ${err.message}`};
      } else {
        errorPayload = { title: "Erro Desconhecido", message: "Ocorreu um erro inesperado ao processar o arquivo. Tente novamente." };
      }
      setError(errorPayload);
      setAppState('error');
    }
  };


  /**
   * Step 2: Handles the selection of a question to start the full, in-depth analysis.
   */
  const handleStartAnalysis = async (question: string) => {
    if (!currentFile) {
      setError({ title: "Erro de Aplicação", message: "Nenhum arquivo encontrado para análise. Por favor, reinicie o processo." });
      setAppState('error');
      return;
    }
    setAppState('loading-analysis');
    setError(null);
    try {
      // FIX: performInitialAnalysis now takes the file and the selected question.
      const result = await performInitialAnalysis(currentFile, question);
      setAnalysisResult(result);
      setAppState('chat');
    } catch (err) {
      console.error(err);
      let errorPayload: AppError;
      if (err instanceof GeminiApiError) {
        errorPayload = { title: "Erro de Comunicação com a IA", message: err.message };
      } else if (err instanceof DataParsingError) {
        errorPayload = { title: err.title || "Erro de Interpretação dos Dados", message: `A resposta da IA não pôde ser processada. ${err.message}` };
      } else if (err instanceof Error) {
        errorPayload = { title: "Erro Inesperado", message: `Ocorreu um problema: ${err.message}` };
      } else {
        errorPayload = { title: "Erro Desconhecido", message: "Ocorreu um erro inesperado ao analisar o arquivo. Tente novamente."};
      }
      
      setError(errorPayload);
      setAppState('error');
    }
  };

  const handleReset = () => {
    setAppState('pre-analysis');
    setAnalysisResult(null);
    setPreAnalysisResult(null);
    setCurrentFile(null);
    setError(null);
  };

  const renderContent = () => {
    switch (appState) {
      case 'loading-pre-analysis':
        return <LoadingIndicator text="Processando seu arquivo e iniciando a análise prévia..." />;
      case 'loading-analysis':
        return <LoadingIndicator text="Analisando seu conjunto de dados... Isso pode levar um momento." />;
      case 'showing_suggestions':
        return (
          <PreAnalysisView
            preAnalysis={preAnalysisResult!}
            onQuestionSelect={handleStartAnalysis}
            fileName={currentFile!.name}
          />
        );
      case 'chat':
        if (analysisResult && currentFile) {
          return <ChatInterface initialAnalysis={analysisResult} file={currentFile} onReset={handleReset} />;
        }
        // Fallback to error if data is missing
        setError({ title: "Erro de Estado da Aplicação", message: "Ocorreu um erro inesperado. Faltam dados da análise para iniciar o chat."});
        setAppState('error');
        return null; // The component will re-render into the error state
      case 'error':
        return (
          <ErrorDisplay 
            title={error?.title || "Falha no Processamento"}
            message={error?.message || "Ocorreu um erro desconhecido."}
            onRetry={handleReset}
          />
        );
      case 'pre-analysis':
      default:
        return <PreAnalysisView onFileSelect={handlePreAnalysis} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
      <Header />
      <main className="flex-1 overflow-hidden p-4 md:p-8">
        <div className="h-full max-w-7xl mx-auto flex flex-col items-center justify-center">
            {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;