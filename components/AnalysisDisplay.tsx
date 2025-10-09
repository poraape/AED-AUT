

import React from 'react';
// FIX: Import DataProfile to use for displaying the data summary.
import type { AnalysisResult, DataProfile } from '../types';
import ChartRenderer from './ChartRenderer';
import TypingEffect from './TypingEffect';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  messageId: string;
  showSummary?: boolean;
  // FIX: Add dataProfile to props to display the data summary.
  dataProfile?: DataProfile;
  onQuestionSelect?: (question: string) => void;
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, messageId, showSummary = false, dataProfile, onQuestionSelect, onDrillDown }) => {
  return (
    <div className="space-y-6 mt-4 border-t border-gray-600 pt-4">
      {/* FIX: Use dataProfile to display summary information instead of the non-existent inspection_summary. */}
      {showSummary && dataProfile && (
        <details className="bg-gray-900/50 p-4 rounded-lg" open>
            <summary className="font-semibold text-lg cursor-pointer text-gray-200">Perfil dos Dados</summary>
            <div className="mt-3 text-sm text-gray-300 space-y-2">
            <p><strong>Linhas:</strong> {dataProfile.rowCount}</p>
            <p><strong>Colunas:</strong> {dataProfile.columnCount}</p>
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
                    {dataProfile.columns.map((col) => (
                    <tr key={col.name} className="border-b border-gray-700">
                        <td className="p-2 font-mono">{col.name}</td>
                        <td className="p-2 font-mono">{col.type}</td>
                        <td className="p-2 font-mono">{col.missing}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>
        </details>
      )}

      {result.findings && result.findings.length > 0 && (
        <div className="space-y-6">
           <h3 className="font-semibold text-lg text-gray-200 px-4">Principais Achados da Análise</h3>
           {result.findings.map((finding, index) => (
             <div key={index} className="bg-gray-900/50 p-4 rounded-lg">
                <TypingEffect text={finding.insight} className="text-sm text-gray-300 mb-4" />
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
