import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import type { PlotSpec } from '../types';
import { ChartType } from '../types';
import { CogIcon } from './icons/CogIcon';
import { CameraIcon } from './icons/CameraIcon';
import Spinner from './Spinner';

interface ChartRendererProps {
  spec: PlotSpec;
  chartId: string;
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

// Define color palettes
const PALETTES = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'],
  vibrant: ['#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557', '#E76F51', '#2A9D8F'],
  corporate: ['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600', '#2c7b90', '#f95d6a'],
};
type PaletteName = keyof typeof PALETTES;


type DataType = 'numeric' | 'categorical' | 'unknown';

/**
 * Helper function to infer data types from the first row of data.
 */
const getDataTypes = (data: Record<string, any>[]): Record<string, DataType> => {
  if (!data || data.length === 0) {
    return {};
  }
  const firstRow = data[0];
  const types: Record<string, DataType> = {};
  for (const key in firstRow) {
    const value = firstRow[key];
    if (typeof value === 'number') {
      types[key] = 'numeric';
    } else if (typeof value === 'string') {
      types[key] = 'categorical';
    } else {
      types[key] = 'unknown';
    }
  }
  return types;
};

/**
 * Intelligently determines the most appropriate chart type, overriding the AI's suggestion if necessary.
 * This ensures the visualization is statistically sound and easy to interpret.
 */
const determineAppropriateChartType = (
  spec: PlotSpec,
  dataTypes: Record<string, DataType>
): ChartType => {
  const { chart_type, data_keys } = spec;

  // If we don't have the necessary keys to analyze, we can't make a decision.
  if (!data_keys) return chart_type;

  const xKey = data_keys.x;
  const yKeys = data_keys.y || [];

  const xType = xKey ? dataTypes[xKey] : 'unknown';
  const yTypes = yKeys.map(key => dataTypes[key]);

  // --- Rule 1: Force Scatter Plot for Numeric Correlation ---
  // To best visualize the relationship or correlation between two numerical variables,
  // a scatter plot is the standard and most effective choice. This rule has the highest priority.
  if (xType === 'numeric' && yKeys.length === 1 && yTypes[0] === 'numeric') {
    return ChartType.SCATTER;
  }

  // --- Rule 2: Handle Categorical vs. Numeric Data ---
  // When plotting a numeric value across different categories (e.g., sales per month),
  // a bar or line chart is appropriate.
  if (xType === 'categorical' && yTypes.every(t => t === 'numeric')) {
    // Respect the AI's suggestion if it's valid for this data type (Bar or Line).
    if (chart_type === ChartType.BAR || chart_type === ChartType.LINE) {
      return chart_type;
    }
    // If the AI suggested an unsuitable chart (like scatter), we correct it to a bar chart by default.
    return ChartType.BAR;
  }

  // --- Fallback ---
  // If no specific rule matches, we trust the original suggestion from the AI.
  return chart_type;
};


const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, chartId, onDrillDown }) => {
  const { title, description, data, data_keys } = spec;

  // State for customizations
  const [showTooltip, setShowTooltip] = useState(true);
  const [currentPalette, setCurrentPalette] = useState<PaletteName>('default');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const colors = PALETTES[currentPalette];
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);


  const { correctedChartType, wasCorrected } = useMemo(() => {
    if (!data || data.length === 0) {
      return { correctedChartType: spec.chart_type, wasCorrected: false };
    }
    const dataTypes = getDataTypes(data);
    const correctedType = determineAppropriateChartType(spec, dataTypes);
    return {
      correctedChartType: correctedType,
      wasCorrected: correctedType !== spec.chart_type,
    };
  }, [spec, data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getStyledSvgString = async (): Promise<string | null> => {
    if (!chartContainerRef.current) return null;
    
    const svgElement = chartContainerRef.current.querySelector('svg');
    if (!svgElement) {
        throw new Error("Elemento SVG não encontrado");
    }

    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
        text, .recharts-text {
            font-family: 'Inter', sans-serif !important;
            font-size: 12px !important;
            fill: #c9c9c9 !important; /* gray-300 */
        }
        .recharts-legend-item-text {
            fill: #e9e9e9 !important; /* gray-200 */
        }
        .recharts-tooltip-label, .recharts-tooltip-item {
             font-family: 'Inter', sans-serif !important;
             color: #e0e0e0 !important;
        }
    `;
    svgClone.prepend(styleElement);

    return new XMLSerializer().serializeToString(svgClone);
  };

  const handleDownloadAsPNG = async () => {
    setIsDownloadMenuOpen(false);
    if (!chartContainerRef.current) return;
    setIsDownloading(true);

    try {
        const svgString = await getStyledSvgString();
        if (!svgString) throw new Error("Não foi possível gerar a string SVG.");

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const pngDataUrl = await new Promise<string>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 2;
                const bounds = chartContainerRef.current!.querySelector('svg')!.getBoundingClientRect();
                canvas.width = bounds.width * scale;
                canvas.height = bounds.height * scale;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.fillStyle = '#2a2a2a'; // Match gray-800 background
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(scale, scale);
                    ctx.drawImage(image, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    reject(new Error('Não foi possível obter o contexto do canvas'));
                }
                URL.revokeObjectURL(url);
            };
            image.onerror = (err) => {
                console.error("Image loading error:", err);
                reject(new Error('Falha ao carregar a imagem SVG para conversão.'));
                URL.revokeObjectURL(url);
            };
            image.src = url;
        });

        const a = document.createElement('a');
        const safeTitle = spec.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle || 'grafico'}.png`;
        a.href = pngDataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (error) {
        console.error("Falha ao baixar o gráfico como PNG:", error);
        alert("Desculpe, ocorreu um erro ao salvar o gráfico como PNG.");
    } finally {
        setIsDownloading(false);
    }
  };

  const handleDownloadAsSVG = async () => {
    setIsDownloadMenuOpen(false);
    if (!chartContainerRef.current) return;
    setIsDownloading(true);

    try {
        const svgString = await getStyledSvgString();
        if (!svgString) throw new Error("Não foi possível gerar a string SVG.");

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const a = document.createElement('a');
        const safeTitle = spec.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle || 'grafico'}.svg`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error("Falha ao baixar o gráfico como SVG:", error);
        alert("Desculpe, ocorreu um erro ao salvar o gráfico como SVG.");
    } finally {
        setIsDownloading(false);
    }
  };

  const handleBarClick = (data: any) => {
    if (onDrillDown && data && data.payload) {
        onDrillDown(title, data.payload);
    }
  };

  const renderChart = () => {
    switch (correctedChartType) {
      case ChartType.BAR:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
            <XAxis dataKey={data_keys.x} stroke="#9a9a9a" />
            <YAxis stroke="#9a9a9a" />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #4a4a4a' }} />}
            <Legend />
            {data_keys.y.map((yKey, index) => (
                 <Bar 
                    key={yKey} 
                    dataKey={yKey} 
                    fill={colors[index % colors.length]} 
                    onClick={handleBarClick}
                    cursor={onDrillDown ? "pointer" : "default"}
                 />
            ))}
          </BarChart>
        );
      case ChartType.LINE:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
            <XAxis dataKey={data_keys.x} stroke="#9a9a9a" />
            <YAxis stroke="#9a9a9a" />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #4a4a4a' }} />}
            <Legend />
            {data_keys.y.map((yKey, index) => (
                <Line key={yKey} type="monotone" dataKey={yKey} stroke={colors[index % colors.length]} />
            ))}
          </LineChart>
        );
       case ChartType.SCATTER:
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
            <XAxis type="number" dataKey={data_keys.x} name={data_keys.x} stroke="#9a9a9a" />
            <YAxis type="number" dataKey={data_keys.y[0]} name={data_keys.y[0]} stroke="#9a9a9a" />
            <ZAxis range={[100, 101]} />
            {showTooltip && <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #4a4a4a' }} />}
            <Legend />
            <Scatter name={title} data={data} fill={colors[0]} />
          </ScatterChart>
        );
      case ChartType.PIE:
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={data_keys.value}
              nameKey={data_keys.name}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #4a4a4a' }} />}
            <Legend />
          </PieChart>
        );
      default:
        return <p className="text-red-400">Tipo de gráfico não suportado: {spec.chart_type}</p>;
    }
  };

  return (
    <div id={chartId} ref={chartContainerRef}>
       <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
            <h4 className="font-semibold text-md text-gray-200">{title}</h4>
            <p className="text-xs text-gray-400 mb-4">{description}</p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="relative" ref={downloadMenuRef}>
                <button
                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                    disabled={isDownloading}
                    className="p-1 text-gray-400 hover:text-white transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
                    aria-label="Salvar gráfico"
                    title="Salvar gráfico"
                >
                    {isDownloading ? <Spinner /> : <CameraIcon className="w-5 h-5" />}
                </button>
                {isDownloadMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10 animate-fade-in-sm">
                        <ul className="py-1">
                           <li>
                               <button onClick={handleDownloadAsPNG} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">
                                   Salvar como PNG
                               </button>
                           </li>
                           <li>
                               <button onClick={handleDownloadAsSVG} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">
                                   Salvar como SVG
                               </button>
                           </li>
                        </ul>
                    </div>
                )}
            </div>
            <div className="relative" ref={settingsRef}>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-1 text-gray-400 hover:text-white transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    aria-label="Configurações do Gráfico"
                >
                    <CogIcon className="w-5 h-5" />
                </button>
                {isSettingsOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10 p-3 animate-fade-in-sm">
                        <div className="space-y-3">
                            <label className="flex items-center justify-between text-sm text-gray-200 cursor-pointer">
                                <span>Mostrar Dicas</span>
                                <input
                                    type="checkbox"
                                    checked={showTooltip}
                                    onChange={() => setShowTooltip(!showTooltip)}
                                    className="sr-only peer"
                                />
                                <div className="relative w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                            </label>
                            
                            <div>
                                <span className="block text-sm font-semibold text-gray-200 mb-2">Paleta de Cores</span>
                                <div className="flex flex-col space-y-2">
                                    {Object.entries(PALETTES).map(([paletteName, paletteColors]) => (
                                        <button 
                                            key={paletteName} 
                                            onClick={() => { setCurrentPalette(paletteName as PaletteName); setIsSettingsOpen(false); }}
                                            className={`w-full h-6 rounded flex items-center p-0.5 border-2 ${currentPalette === paletteName ? 'border-indigo-400' : 'border-transparent hover:border-gray-500'}`}
                                            aria-label={`Selecionar paleta de cores ${paletteName}`}
                                        >
                                            <div className="flex w-full h-full rounded-sm overflow-hidden">
                                                {paletteColors.slice(0, 5).map(color => (
                                                    <span key={color} className="w-1/5 h-full" style={{ backgroundColor: color }}></span>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
      {wasCorrected && (
        <p className="text-xs text-yellow-400 mb-2 italic">
          *Tipo de gráfico ajustado para melhor visualização.
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;