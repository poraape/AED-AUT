
import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadError(null);
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setUploadError(null);
    const file = event.dataTransfer.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip'))) {
      setFileName(file.name);
      onFileSelect(file);
    } else {
        setUploadError("Tipo de arquivo inválido. Por favor, envie um arquivo CSV ou um arquivo ZIP contendo um CSV.");
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

    const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);


  return (
    <div className="w-full max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-center text-gray-100 mb-4">Inicie sua Análise de Dados</h2>
        <p className="text-center text-gray-400 mb-8">Envie um arquivo CSV ou um ZIP (contendo um CSV) para começar.</p>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-gray-800' : 'border-gray-600 hover:border-gray-500'}`}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".csv,.zip"
          onChange={handleFileChange}
        />
        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
          <svg className="w-12 h-12 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <p className="text-gray-400">
            <span className="font-semibold text-indigo-400">Clique para carregar</span> ou arraste e solte
          </p>
          <p className="text-xs text-gray-500 mt-1">Suporta arquivos .csv e .zip</p>
          {fileName && !uploadError && <p className="text-sm text-green-400 mt-4">Arquivo selecionado: {fileName}</p>}
        </label>
      </div>
       {uploadError && (
        <p className="text-sm text-red-400 mt-4 text-center">{uploadError}</p>
      )}
    </div>
  );
};

export default FileUpload;
