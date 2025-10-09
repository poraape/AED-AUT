// FIX: Implemented the ChartRenderer component to fix module resolution errors and provide data visualization.
import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, TooltipProps
} from 'recharts';
import type { PlotSpec } from '../types';

// Define a color palette for the charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

interface ChartRendererProps {
  spec: PlotSpec;
  chartId: string; // The parent container will have this ID
  onDrillDown?: (chartTitle: string, dataPoint: Record<string, any>) => void;
}

// Custom Tooltip for better display
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-700 p-2 border border-gray-600 rounded shadow-lg text-sm">
        <p className="font-bold text-gray-100">{`${label}`}</p>
        {payload.map((pld, index) => (
          <p key={index} style={{ color: pld.color }} className="text-gray-200">
            {`${pld.name}: ${pld.value?.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, chartId, onDrillDown }) => {
  if (!spec || !spec.data || spec.data.length === 0) {
    return <div className="text-gray-400 text-sm">Dados insuficientes para gerar o gráfico.</div>;
  }

  const { chart_type, title, description, data, data_keys } = spec;

  const handleDataClick = (dataPoint: any) => {
    if (onDrillDown && dataPoint && dataPoint.payload) {
      // The payload in recharts contains the original data object for that point
      onDrillDown(title, dataPoint.payload);
    }
  };

  const renderChart = () => {
    switch (chart_type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
            <XAxis dataKey={data_keys.x} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(136, 132, 216, 0.2)' }} />
            <Legend wrapperStyle={{fontSize: "12px"}} />
            {data_keys.y?.map((key, index) => (
              <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} onClick={handleDataClick} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
            <XAxis dataKey={data_keys.x} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}} />
            {data_keys.y?.map((key, index) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6, onClick: handleDataClick }} />
            ))}
          </LineChart>
        );
      case 'pie':
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
              labelLine={false}
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                return (
                  <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                );
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} onClick={() => handleDataClick({ payload: entry })} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}} />
          </PieChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid stroke="#4a4a4a" />
            <XAxis type="number" dataKey={data_keys.x} name={data_keys.x} stroke="#9ca3af" fontSize={12} />
            <YAxis type="number" dataKey={data_keys.y?.[0]} name={data_keys.y?.[0]} stroke="#9ca3af" fontSize={12} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            <Scatter name={title} data={data} fill={COLORS[0]} onClick={handleDataClick} />
          </ScatterChart>
        );
      default:
        return <div className="text-red-400 text-sm">Tipo de gráfico desconhecido: {chart_type}</div>;
    }
  };

  return (
    // The parent div gets the ID, not the SVG itself.
    <div id={chartId} className="w-full h-72">
      <h4 className="text-md font-semibold text-gray-200 mb-1 text-center">{title}</h4>
      <p className="text-xs text-gray-400 mb-2 text-center">{description}</p>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;
