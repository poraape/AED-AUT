import React from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-900/70 backdrop-blur-md border-b border-gray-700 p-4 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg">
            <SparklesIcon className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-100 tracking-tight">
            EDA-X Agente Autônomo
          </h1>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
           <SparklesIcon className="w-4 h-4 text-indigo-400" />
           <span>Desenvolvido com Gemini</span>
        </div>
      </div>
    </header>
  );
};

export default Header;