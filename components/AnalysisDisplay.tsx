import React from 'react';
import type { AnalysisResult } from '../types';
import ChartRenderer from './ChartRenderer';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  messageId: string;
  showSummary?: boolean;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, messageId, showSummary = false }) => {
  return (
    <div className="space-y-6 mt-4 border-t border-gray-600 pt-4">
      {/* Data Inspection Summary - Conditionally Rendered */}
      {showSummary && (
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
                         <ChartRenderer spec={finding.plot} chartId={`chart-${messageId}-${index}`} />
                    </div>
                )}
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default AnalysisDisplay;