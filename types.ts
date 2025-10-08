// FIX: Defining an enum for chart types for better type safety.
export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  SCATTER = 'scatter',
}

// FIX: Defining the shape of a plot specification.
export interface PlotSpec {
  chart_type: ChartType;
  title: string;
  description: string;
  data: Record<string, any>[];
  data_keys: {
    x?: string;
    y?: string[];
    name?: string;
    value?: string;
  };
}

// FIX: Defining the shape of column details.
export interface ColumnDetail {
    name: string;
    type: string;
    missing_values: number;
}

// FIX: Defining the shape of the data inspection summary.
export interface InspectionSummary {
    rows: number;
    columns: number;
    column_details: ColumnDetail[];
}

// A Finding is a single, coherent piece of analysis, linking a textual insight to an optional visualization.
export interface Finding {
    insight: string;
    plot?: PlotSpec;
}

// FIX: Defining the main analysis result structure.
export interface AnalysisResult {
  inspection_summary: InspectionSummary;
  findings: Finding[];
  suggested_followups?: string[];
}

// FIX: Defining the content of a chat message.
export interface ChatMessageContent {
    text: string;
    analysisResult?: AnalysisResult;
}

// FIX: Defining the structure of a chat message.
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: ChatMessageContent;
  isTyping?: boolean;
  isError?: boolean;
}

// FIX: Defining the structure for the pre-analysis result.
export interface PreAnalysisResult {
    summary: string;
    suggestedQuestions: string[];
}