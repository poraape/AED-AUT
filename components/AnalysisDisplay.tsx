import React from 'react';
import type { AnalysisResult } from '../types';
import ChartRenderer from './ChartRenderer';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  messageId: string;
  showSummary?: boolean;
  onQuestionSelect?: (question: string) => void;
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, messageId, showSummary = false, onQuestionSelect, onDrillDown }) => {
  return (
    <div className="space-y-6 mt-4 border-t border-gray-600 pt-4">
      {/* Data Inspection Summary - Conditionally Rendered */}
      {showSummary && result.inspection_summary && (
        <details className="bg-gray-900/50 p-4 rounded-lg" open>
            <summary className="font-semibold text-lg cursor-pointer text-gray-200">Perfil dos Dados</summary>
            <div className="mt-3 text-sm text-gray-300 space-y-2">
            <p><strong>Linhas:</strong> {result.inspection_summary.rows}</p>
            <p><strong>Colunas:</strong> {result.inspection_summary.columns}</p>
            <div className="overflow-x-auto">
                <table className="w-full mt-2 text-left">
                <thead className="bg-gray-700/50">
                    <tr>
                    <th className="p-2">Nome da Coluna</th>
                    <th className="p-2">Tipo de Dado</th>
                    <th className="p-2">Valores Ausentes</th>
                    </tr>
                </thead>
                <tbody>
                    {result.inspection_summary.column_details.map((col) => (
                    <tr key={col.name} className="border-b border-gray-700">
                        <td className="p-2 font-mono">{col.name}</td>
                        <td className="p-2 font-mono">{col.type}</td>
                        <td className="p-2 font-mono">{col.missing_values}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>
        </details>
      )}

      {/* Key Findings */}
      {result.findings && result.findings.length > 0 && (
        <div className="space-y-6">
           <h3 className="font-semibold text-lg text-gray-200 px-4">Principais Achados da Análise</h3>
           {result.findings.map((finding, index) => (
             <div key={index} className="bg-gray-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-300 mb-4">{finding.insight}</p>
                {finding.plot && (
                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mt-4">
                         <ChartRenderer 
                            spec={finding.plot} 
                            chartId={`chart-${messageId}-${index}`}
                            onDrillDown={onDrillDown}
                          />
                    </div>
                )}
             </div>
           ))}
        </div>
      )}

      {/* Suggested Follow-up Questions */}
      {result.suggested_followups && result.suggested_followups.length > 0 && onQuestionSelect && (
        <div className="mt-6">
          <h4 className="font-semibold text-md text-gray-300 mb-3">Próximos passos sugeridos:</h4>
          <div className="flex flex-col space-y-2">
            {result.suggested_followups.map((question, index) => (
              <button
                key={index}
                onClick={() => onQuestionSelect(question)}
                className="text-left text-sm text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisDisplay;