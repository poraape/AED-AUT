
import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ChatMessage, AnalysisResult, Finding } from '../types';
import { getChatResponseStream, summarizeConversation } from '../services/geminiService';
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

// Helper to parse streaming JSON chunks
function parseStreamingJson(jsonString: string): AnalysisResult | null {
    try {
        // Attempt to parse the full string first for a complete object
        return JSON.parse(jsonString) as AnalysisResult;
    } catch (e) {
        // If it fails, it might be an incomplete stream.
        // We can try to find the last complete object structure, but for this app,
        // we'll rely on the final chunk being a valid JSON object.
        // This is a simplification; a more robust solution would handle complex partial objects.
        return null;
    }
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
  const [conversationSummary, setConversationSummary] = useState<string>('');
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

  // Helper function to convert an SVG element to a PNG Data URL
  const convertSvgToPngDataUrl = async (svgElement: SVGSVGElement): Promise<string> => {
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      const styleElement = document.createElement('style');
      styleElement.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
          .recharts-surface, text { font-family: 'Inter', sans-serif; }
          .recharts-text, .recharts-cartesian-axis-tick-value, .recharts-label { font-size: 12px; fill: #c9c9c9; }
          .recharts-legend-item-text { fill: #e9e9e9 !important; }
          .recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line { stroke: #4a4a4a; }
          .recharts-cartesian-grid-line line, .recharts-polar-grid-line line { stroke: #3a3a3a; }
      `;
      svgClone.prepend(styleElement);

      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
              const canvas = document.createElement('canvas');
              const scale = 2;
              const bounds = svgElement.getBoundingClientRect();
              canvas.width = bounds.width * scale;
              canvas.height = bounds.height * scale;
              const ctx = canvas.getContext('2d');

              if (ctx) {
                  ctx.fillStyle = '#121212';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.scale(scale, scale);
                  ctx.drawImage(image, 0, 0);
                  resolve(canvas.toDataURL('image/png'));
              } else {
                  reject(new Error('Could not get canvas context'));
              }
              URL.revokeObjectURL(url);
          };
          image.onerror = () => {
              reject(new Error('Failed to load SVG image for conversion.'));
              URL.revokeObjectURL(url);
          };
          image.src = url;
      });
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
  
    const originalOverflowY = chatContainer.style.overflowY;
    const originalHeight = chatContainer.style.height;
    chatContainer.style.overflowY = 'visible';
    chatContainer.style.height = 'auto';
  
    // Wait for DOM to update and charts to render
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    try {
      const chartElements = Array.from(chatContainer.querySelectorAll<HTMLDivElement>('[id^="chart-"]'));
      const chartDataUrlMap = new Map<string, string | null>();
  
      const conversionPromises = chartElements.map(async (chartElement) => {
        const chartId = chartElement.id;
        const svgElement = chartElement.querySelector('svg');
  
        if (svgElement && svgElement.getBoundingClientRect().width > 0) {
          try {
            const pngDataUrl = await convertSvgToPngDataUrl(svgElement);
            chartDataUrlMap.set(chartId, pngDataUrl);
          } catch (conversionError) {
            console.error(`Error converting chart ${chartId}:`, conversionError);
            chartDataUrlMap.set(chartId, null);
          }
        } else {
          console.warn(`Chart ${chartId} not found or not rendered.`);
          chartDataUrlMap.set(chartId, null);
        }
      });
  
      await Promise.all(conversionPromises);
  
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
              --bg-color: #121212; --surface-color: #1e1e1e; --primary-text: #e0e0e0;
              --secondary-text: #a0a0a0; --border-color: #333333; --user-msg-bg: #3c32e0;
              --agent-msg-bg: #2f2f2f; --shadow-color: rgba(0,0,0,0.3);
            }
            body { font-family: 'Inter', sans-serif; line-height: 1.6; background-color: var(--bg-color); color: var(--primary-text); padding: 20px; margin: 0; }
            .container { max-width: 900px; margin: 0 auto; }
            h1 { font-size: 2.2em; text-align: center; margin-bottom: 1em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5em; font-weight: 600; color: white; }
            .message-container { margin-bottom: 20px; display: flex; flex-direction: column; }
            .user-container { align-items: flex-end; }
            .agent-container { align-items: flex-start; }
            .message { padding: 15px 20px; border-radius: 18px; max-width: 85%; word-wrap: break-word; box-shadow: 0 2px 4px var(--shadow-color); }
            .user { background-color: var(--user-msg-bg); color: white; }
            .agent { background-color: var(--agent-msg-bg); }
            .analysis { border-top: 1px solid var(--border-color); margin-top: 15px; padding-top: 15px; }
            h3, h4 { color: var(--primary-text); margin-top: 1.2em; margin-bottom: 0.6em; font-weight: 600; }
            h3 { font-size: 1.3em; } h4 { font-size: 1.1em; }
            table { width: 100%; border-collapse: collapse; margin-top: 1em; font-size: 0.9em; }
            th, td { border: 1px solid var(--border-color); padding: 10px; text-align: left; }
            th { background-color: var(--surface-color); font-weight: 600; }
            .finding-container { background-color: var(--surface-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; margin-top: 20px; }
            .chart-container { background-color: var(--bg-color); border-radius: 8px; padding: 20px; margin-top: 20px; overflow: hidden; box-shadow: 0 4px 6px var(--shadow-color); }
            img { max-width: 100%; height: auto; border-radius: 8px; }
            p { margin: 0 0 1em 0; } p:last-child { margin-bottom: 0; }
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
        htmlString += `<div class="message-container ${senderContainerClass}"><div class="message ${senderClass}"><p>${msg.content.text.replace(/\n/g, '<br>')}</p>`;
        if (msg.content.analysisResult) {
          const result = msg.content.analysisResult;
          htmlString += `<div class="analysis">`;
          if (result.inspection_summary && !summaryRendered) {
            htmlString += `<h3>Perfil dos Dados</h3><table><thead><tr><th>Nome da Coluna</th><th>Tipo de Dado</th><th>Valores Ausentes</th></tr></thead><tbody>`;
            result.inspection_summary.column_details.forEach(col => {
              htmlString += `<tr><td>${col.name}</td><td>${col.type}</td><td>${col.missing_values}</td></tr>`;
            });
            htmlString += `</tbody></table>`;
            summaryRendered = true;
          }
          if (result.findings?.length > 0) {
            htmlString += `<h3>Principais Achados da Análise</h3>`;
            for (const [index, finding] of result.findings.entries()) {
              htmlString += `<div class="finding-container"><p>${finding.insight}</p>`;
              if (finding.plot) {
                const chartId = `chart-${msg.id}-${index}`;
                const pngDataUrl = chartDataUrlMap.get(chartId);
                if (pngDataUrl) {
                  htmlString += `<div class="chart-container"><h4>${finding.plot.title}</h4><p>${finding.plot.description}</p><img src="${pngDataUrl}" alt="${finding.plot.title}" /></div>`;
                } else {
                  htmlString += `<div class="chart-container"><p style="color: #ffcccc;">Erro: O gráfico '${finding.plot.title}' não pôde ser exportado.</p></div>`;
                }
              }
              htmlString += `</div>`;
            }
          }
          htmlString += `</div>`;
        }
        htmlString += `</div></div>`;
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
      chatContainer.style.overflowY = originalOverflowY;
      chatContainer.style.height = originalHeight;
      setIsExporting(false);
    }
  };
  
  const handleExportToPDF = async () => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) {
      alert("Container do chat não encontrado para exportação.");
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(chatContainer, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        height: chatContainer.scrollHeight,
        windowHeight: chatContainer.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidthMM = 210; // A4 width in mm
      const pageHeightMM = 297; // A4 height in mm
      const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
      let heightLeft = imgHeightMM;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidthMM, imgHeightMM);
      heightLeft -= pageHeightMM;

      while (heightLeft > 0) {
        position -= pageHeightMM;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidthMM, imgHeightMM);
        heightLeft -= pageHeightMM;
      }
      
      pdf.save(`analise_${file.name.replace(/\.csv$/i, '')}.pdf`);
    } catch (error) {
        console.error("Error exporting to PDF:", error);
        alert("Não foi possível exportar a conversa para PDF.");
    } finally {
        setIsExporting(false);
    }
  };


  const handleDrillDown = (chartTitle: string, dataPoint: Record<string, any>) => {
    // Example: dataPoint might be { "Month": "July", "Sales": 4500 }
    const keys = Object.keys(dataPoint);
    const dataPointString = keys.map(key => `${key}: ${dataPoint[key]}`).join(', ');
    const query = `Poderia me dar mais detalhes sobre o ponto de dados (${dataPointString}) do gráfico "${chartTitle}"?`;
    setInput(query);
    submitQuery(query);
  };

  const submitQuery = async (query: string) => {
    if (!query.trim() || isLoading) return;
    setInput(''); // Clear input immediately

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: { text: query },
    };

    const agentTypingId = `agent-typing-${Date.now()}`;
    const agentTypingMessage: ChatMessage = {
      id: agentTypingId,
      sender: 'agent',
      content: { text: '' },
      isTyping: true,
    };
    
    const currentMessages = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage, agentTypingMessage]);
    setIsLoading(true);

    try {
        // --- MEMORY OPTIMIZATION LOGIC ---
        const HISTORY_CHAR_LIMIT = 4000; // Character limit to trigger summarization.
        const RECENT_MESSAGES_TO_KEEP = 4; // Keep the last 2 user/agent turns in full.

        let historyForPrompt = '';
        let summaryForPrompt = conversationSummary;
        const validMessages = currentMessages.filter(m => !m.isTyping);

        const fullHistoryText = validMessages
            .map(m => `${m.sender}: ${m.content.text}`)
            .join('\n');
        
        if (fullHistoryText.length > HISTORY_CHAR_LIMIT) {
            const textToSummarize = validMessages.slice(0, -RECENT_MESSAGES_TO_KEEP)
                .map(m => `${m.sender}: ${m.content.text}`)
                .join('\n');
            
            // Non-blocking call to update summary for the *next* turn.
            summarizeConversation(textToSummarize).then(newSummary => {
                if (newSummary) {
                    setConversationSummary(newSummary);
                }
            });
            
            historyForPrompt = validMessages.slice(-RECENT_MESSAGES_TO_KEEP)
                .map(m => `${m.sender}: ${m.content.text}`)
                .join('\n');

        } else {
            summaryForPrompt = ''; // No need for summary if the full history fits.
            historyForPrompt = fullHistoryText;
        }
        // --- END MEMORY OPTIMIZATION ---
      
      const stream = await getChatResponseStream(file, historyForPrompt, query, summaryForPrompt);

      let accumulatedJson = "";
      for await (const chunk of stream) {
        accumulatedJson += chunk;
        const partialResult = parseStreamingJson(accumulatedJson);
        
        // Post-process data for charts even on partial results
        if (partialResult?.findings) {
            partialResult.findings.forEach((finding: Finding) => {
                if (finding.plot && Array.isArray(finding.plot.data) && finding.plot.data.length > 0 && Array.isArray(finding.plot.data[0])) {
                    const headers = finding.plot.data[0];
                    finding.plot.data = finding.plot.data.slice(1).map((row: any[]) => {
                        const obj: Record<string, any> = {};
                        headers.forEach((header, index) => {
                           const value = row[index];
                           if (value && !isNaN(Number(value))) {
                               obj[header] = Number(value);
                           } else {
                               obj[header] = value;
                           }
                        });
                        return obj;
                    });
                }
            });
        }
        
        setMessages(prev => {
            const newMessages = [...prev];
            const typingIndex = newMessages.findIndex(m => m.id === agentTypingId);
            if (typingIndex !== -1) {
                newMessages[typingIndex] = {
                    ...newMessages[typingIndex],
                    isTyping: true, // Keep it in "typing" mode but with content
                    content: {
                        text: "Com base em sua solicitação, aqui estão os principais achados que identifiquei.",
                        analysisResult: partialResult ?? undefined,
                    },
                };
            }
            return newMessages;
        });
      }

      // Final update: switch from typing to final message
      setMessages(prev => {
        const finalMessages = [...prev];
        const typingIndex = finalMessages.findIndex(m => m.id === agentTypingId);
        if (typingIndex !== -1) {
          const finalResult = JSON.parse(accumulatedJson) as AnalysisResult;
           // Final data conversion
          if (finalResult.findings) {
             finalResult.findings.forEach((finding: Finding) => {
                if (finding.plot && Array.isArray(finding.plot.data) && finding.plot.data.length > 0 && Array.isArray(finding.plot.data[0])) {
                     const headers = finding.plot.data[0];
                     finding.plot.data = finding.plot.data.slice(1).map((row: any[]) => {
                        const obj: Record<string, any> = {};
                        headers.forEach((header, index) => {
                           const value = row[index];
                           if (value && !isNaN(Number(value))) {
                               obj[header] = Number(value);
                           } else {
                               obj[header] = value;
                           }
                        });
                        return obj;
                    });
                }
            });
          }
          finalMessages[typingIndex].isTyping = false;
          finalMessages[typingIndex].content.analysisResult = finalResult;
        }
        return finalMessages;
      });

    } catch (error) {
      console.error("Failed to get chat response:", error);
      let errorMessageText: string;

      if (error instanceof GeminiApiError) {
        if (error.message.toLowerCase().includes('quota')) {
          errorMessageText = "Desculpe, parece que atingimos o limite de solicitações à IA no momento. Por favor, aguarde alguns minutos antes de tentar novamente.";
        } else if (error.message.toLowerCase().includes('api key')) {
          errorMessageText = "Ocorreu um problema de configuração interna. A equipe técnica já foi notificada. Por favor, tente novamente mais tarde.";
        } else {
          errorMessageText = "Houve um problema de comunicação com o serviço de IA. Isso pode ser um problema temporário. Verifique sua conexão e tente novamente.";
        }
      } else if (error instanceof DataParsingError) {
        errorMessageText = "Não consegui interpretar a resposta da IA. Isso pode acontecer se a análise for muito complexa ou se os dados tiverem um formato inesperado. Tente reformular sua pergunta para ser mais específica ou simples.";
      } else {
        errorMessageText = "Ocorreu um erro inesperado ao processar sua solicitação. Tente fazer uma pergunta diferente ou, se o problema persistir, comece uma nova análise.";
      }

      const errorMessage: ChatMessage = {
        id: `agent-error-${Date.now()}`,
        sender: 'agent',
        content: { text: errorMessageText },
        isError: true,
      };
      setMessages(prev => [...prev.filter(m => m.id !== agentTypingId), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(input);
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
                      <button onClick={handleExportToPDF} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">Exportar Relatório (PDF)</button>
                    </li>
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
            onSuggestionClick={submitQuery}
            onDrillDown={handleDrillDown}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
        <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto flex items-center space-x-3">
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
