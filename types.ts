export interface PlotSpec {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  description: string;
  data: Record<string, any>[];
  data_keys: {
    x: string;
    y?: string[];
    value?: string;
    name?: string;
  };
}

export interface Finding {
  insight: string;
  plot?: PlotSpec;
}

export interface AnalysisResult {
  findings: Finding[];
  suggested_followups: string[];
}

export interface ChatMessageContent {
  text: string;
  analysisResult?: AnalysisResult;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: ChatMessageContent;
  isTyping?: boolean;
  isError?: boolean;
}

export interface DataProfileColumn {
  name: string;
  type: string;
  missing: number;
}

export interface DataProfile {
  rowCount: number;
  columnCount: number;
  columns: DataProfileColumn[];
}

export interface PreAnalysisResult {
  summary: string;
  suggestedQuestions: string[];
}
