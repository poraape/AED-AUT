import React from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="w-8 h-8 text-indigo-400" />
          <h1 className="text-xl font-bold text-gray-100 tracking-tight">
            Agente Autônomo de AED
          </h1>
        </div>
        <div className="text-sm text-gray-400">Desenvolvido com Gemini</div>
      </div>
    </header>
  );
};

export default Header;