
import React from 'react';
import { WarningIcon } from './icons/WarningIcon';

interface ErrorDisplayProps {
  title: string;
  message: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ title, message, onRetry }) => {
  return (
    <div className="text-center p-6 bg-gray-800 border border-red-500/50 rounded-lg shadow-lg max-w-lg mx-auto animate-fade-in">
      <div className="flex justify-center items-center mx-auto w-12 h-12 rounded-full bg-red-500/20 mb-4">
        <WarningIcon className="w-7 h-7 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-red-300 mb-2">{title}</h2>
      <p className="text-gray-300 mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
      >
        Tente Novamente
      </button>
    </div>
  );
};

export default ErrorDisplay;
