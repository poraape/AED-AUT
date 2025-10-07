import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, AnalysisResult } from '../types';
import { getChatResponse } from '../services/geminiService';
import Message from './Message';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { SendIcon } from './icons/SendIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { GeminiApiError, DataParsingError } from '../services/errors';

interface ChatInterfaceProps {
  initialAnalysis: AnalysisResult;
  file: File;
  onReset: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialAnalysis, file, onReset }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'initial-agent-message',
      sender: 'agent',
      content: {
        text: "Aqui está a análise inicial do seu conjunto de dados. O que mais você gostaria de explorar?",
        analysisResult: initialAnalysis,
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportToJSON = () => {
    setIsExportMenuOpen(false);
    const allAnalyses = messages
      .filter(msg => msg.sender === 'agent' && msg.content.analysisResult)
      .map(msg => msg.content.analysisResult);

    if (allAnalyses.length === 0) {
      alert("Nenhum dado de análise para exportar.");
      return;
    }

    const jsonString = JSON.stringify(allAnalyses, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights_analise_${file.name.replace(/\.csv$/i, '.json')}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportToCSV = () => {
    setIsExportMenuOpen(false);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados_brutos_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportToHTML = async () => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) {
      alert("Não foi possível encontrar o container do chat para exportar.");
      setIsExporting(false);
      return;
    }

    // Temporarily expand the container to ensure all elements are in the DOM and rendered
    const originalOverflowY = chatContainer.style.overflowY;
    const originalHeight = chatContainer.style.height;
    chatContainer.style.overflowY = 'visible';
    chatContainer.style.height = 'auto';

    // Give the browser a generous moment to reflow and for recharts to render everything.
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      let htmlString = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exportação da Análise de Dados</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
          :root {
            --bg-color: #121212;
            --surface-color: #1e1e1e;
            --primary-text: #e0e0e0;
            --secondary-text: #a0a0a0;
            --border-color: #333333;
            --user-msg-bg: #3c32e0;
            --agent-msg-bg: #2f2f2f;
            --shadow-color: rgba(0,0,0,0.3);
          }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.6; 
            background-color: var(--bg-color); 
            color: var(--primary-text); 
            padding: 20px; 
            margin: 0;
          }
          .container { max-width: 900px; margin: 0 auto; }
          h1 { 
            font-size: 2.2em; 
            text-align: center; 
            margin-bottom: 1em; 
            border-bottom: 1px solid var(--border-color); 
            padding-bottom: 0.5em; 
            font-weight: 600;
            color: white;
          }
          .message-container { 
            margin-bottom: 20px; 
            display: flex; 
            flex-direction: column; 
          }
          .user-container { align-items: flex-end; }
          .agent-container { align-items: flex-start; }
          .message { 
            padding: 15px 20px; 
            border-radius: 18px; 
            max-width: 85%; 
            word-wrap: break-word; 
            box-shadow: 0 2px 4px var(--shadow-color);
          }
          .user { background-color: var(--user-msg-bg); color: white; }
          .agent { background-color: var(--agent-msg-bg); }
          .analysis { 
            border-top: 1px solid var(--border-color); 
            margin-top: 15px; 
            padding-top: 15px; 
          }
          h3, h4 { 
            color: var(--primary-text); 
            margin-top: 1.2em; 
            margin-bottom: 0.6em; 
            font-weight: 600; 
          }
          h3 { font-size: 1.3em; }
          h4 { font-size: 1.1em; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 1em; 
            font-size: 0.9em; 
          }
          th, td { 
            border: 1px solid var(--border-color); 
            padding: 10px; 
            text-align: left; 
          }
          th { 
            background-color: var(--surface-color); 
            font-weight: 600; 
          }
          .finding-container {
             background-color: var(--surface-color);
             border: 1px solid var(--border-color);
             border-radius: 8px;
             padding: 20px;
             margin-top: 20px;
          }
          .chart-container { 
            background-color: var(--bg-color); 
            border-radius: 8px; 
            padding: 20px; 
            margin-top: 20px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px var(--shadow-color);
          }
          svg { 
            max-width: 100%; 
            height: auto; 
            display: block; 
            margin: 0 auto; 
            font-family: inherit; 
          }
          p { margin: 0 0 1em 0; }
          p:last-child { margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Análise de Dados: ${file.name}</h1>
      `;
      
      let summaryRendered = false;

      for (const msg of messages) {
        if (msg.isTyping) continue;

        const senderClass = msg.sender === 'user' ? 'user' : 'agent';
        const senderContainerClass = msg.sender === 'user' ? 'user-container' : 'agent-container';
        
        htmlString += `<div class="message-container ${senderContainerClass}"><div class="message ${senderClass}">`;
        htmlString += `<p>${msg.content.text.replace(/\n/g, '<br>')}</p>`;

        if (msg.content.analysisResult) {
          const result = msg.content.analysisResult;
          htmlString += `<div class="analysis">`;

          // Data Profile - Render only once
          if (result.inspection_summary && !summaryRendered) {
            htmlString += `<h3>Perfil dos Dados</h3>`;
            htmlString += `<table><thead><tr><th>Nome da Coluna</th><th>Tipo de Dado</th><th>Valores Ausentes</th></tr></thead><tbody>`;
            result.inspection_summary.column_details.forEach(col => {
              htmlString += `<tr><td>${col.name}</td><td>${col.type}</td><td>${col.missing_values}</td></tr>`;
            });
            htmlString += `</tbody></table>`;
            summaryRendered = true;
          }

          // Findings
          if (result.findings && result.findings.length > 0) {
            htmlString += `<h3>Principais Achados da Análise</h3>`;
            result.findings.forEach((finding, index) => {
              htmlString += `<div class="finding-container">`;
              htmlString += `<p>${finding.insight}</p>`;

              if (finding.plot) {
                const chartId = `chart-${msg.id}-${index}`;
                const chartElement = document.getElementById(chartId);
                const svgElement = chartElement?.querySelector('svg');
                
                if (svgElement) {
                  // Clone the node to avoid modifying the live DOM
                  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
                  
                  // Ensure the SVG has the correct XML namespace for proper rendering
                  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                  // Create a style block to embed directly into the SVG.
                  // This ensures that styles applied via CSS classes (like text color and font) are preserved.
                  const styleElement = document.createElement('style');
                  styleElement.innerHTML = `
                    /* Import the font used in the application */
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
                    
                    /* Apply base styles to all text within the SVG */
                    text {
                      font-family: 'Inter', sans-serif;
                      font-size: 12px;
                      fill: #a0a0a0; /* Replicate --secondary-text color */
                    }

                    /* Style for legend text */
                    .recharts-legend-item-text {
                      fill: #e0e0e0 !important; /* Replicate --primary-text for better readability */
                    }
                  `;
                  svgClone.prepend(styleElement);

                  const serializer = new XMLSerializer();
                  const svgString = serializer.serializeToString(svgClone);
                  
                  htmlString += `<div class="chart-container"><h4>${finding.plot.title}</h4><p>${finding.plot.description}</p>`;
                  htmlString += svgString;
                  htmlString += `</div>`;
                } else {
                   htmlString += `<div class="chart-container"><p style="color: #ffcccc;">Erro: O gráfico com ID ${chartId} não foi encontrado no DOM. Pode não ter sido renderizado a tempo para a exportação.</p></div>`;
                }
              }
              htmlString += `</div>`; // close finding-container
            });
          }
          htmlString += `</div>`; // close analysis
        }
        htmlString += `</div></div>`; // close message and container
      }

      htmlString += `</div></body></html>`;

      const blob = new Blob([htmlString], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversa-analise.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error exporting to HTML:", error);
      alert("Não foi possível exportar a conversa para HTML.");
    } finally {
      // Restore original styles to the live chat container
      chatContainer.style.overflowY = originalOverflowY;
      chatContainer.style.height = originalHeight;
      setIsExporting(false);
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: { text: input },
    };

    const agentTypingMessage: ChatMessage = {
        id: `agent-typing-${Date.now()}`,
        sender: 'agent',
        content: { text: '' },
        isTyping: true,
    }

    setMessages(prev => [...prev, userMessage, agentTypingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historySummary = messages
        .filter(m => !m.isTyping)
        .map(m => `${m.sender}: ${m.content.text}`)
        .join('\n');
      
      const result = await getChatResponse(file, historySummary, input);

      const agentResponse: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        content: {
          text: `Com base em sua solicitação, aqui estão os principais achados que identifiquei.`,
          analysisResult: result,
        },
      };

      setMessages(prev => [...prev.slice(0, -1), agentResponse]);
    } catch (error) {
      console.error("Failed to get chat response:", error);
      let errorMessageText = "Desculpe, não consegui processar sua solicitação. Por favor, tente novamente.";
      
      if (error instanceof GeminiApiError || error instanceof DataParsingError) {
        errorMessageText = `Desculpe, ocorreu um erro: ${error.message}`;
      }

      const errorMessage: ChatMessage = {
        id: `agent-error-${Date.now()}`,
        sender: 'agent',
        content: { text: errorMessageText },
        isError: true,
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 w-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800/70 backdrop-blur-sm border-b border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
            <PaperclipIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">{file.name}</span>
        </div>
        <div className="flex items-center space-x-4">
            <div className="relative" ref={exportMenuRef}>
              <button 
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  disabled={isExporting}
                  className="flex items-center space-x-2 text-sm text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                  <DownloadIcon className="w-4 h-4" />
                  <span>{isExporting ? 'Exportando...' : 'Exportar'}</span>
              </button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20">
                  <ul className="py-1">
                    <li>
                      <button onClick={handleExportToHTML} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">Exportar como HTML</button>
                    </li>
                    <li>
                      <button onClick={handleExportToJSON} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">Exportar Insights (JSON)</button>
                    </li>
                    <li>
                      <button onClick={handleExportToCSV} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">Exportar Dados Brutos (CSV)</button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <button 
                onClick={onReset}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
                Analisar outro arquivo
            </button>
        </div>
      </div>

      {/* Message List */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <Message 
            key={msg.id} 
            message={msg}
            showSummary={msg.id === 'initial-agent-message'}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre seus dados..."
            disabled={isLoading}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 text-white rounded-lg p-2.5 hover:bg-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;