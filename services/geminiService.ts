import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
// FIX: Importing all necessary types from the corrected types.ts file.
import type { AnalysisResult, PreAnalysisResult, Finding } from '../types';
import { GeminiApiError, DataParsingError } from "./errors";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY not found in environment variables. Please ensure process.env.API_KEY is set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Retry Logic Configuration ---
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // Start with a 2-second backoff

/**
 * A helper function to create a delay.
 * @param ms - The number of milliseconds to wait.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A wrapper that attempts to call a function, retrying with exponential backoff if a rate limit error occurs.
 * @param apiCall - The asynchronous function to call.
 * @returns The result of the successful API call.
 * @throws The last error if all retries fail, or the first error if it's not a retriable one.
 */
async function callApiWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await apiCall(); // Attempt the API call
    } catch (error) {
      lastError = error as Error;
      
      // Check for specific, retriable rate-limiting/quota error messages from the Gemini API
      if (error instanceof Error && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        if (attempt < MAX_RETRIES - 1) {
          // Calculate backoff time with jitter (randomness to prevent synchronized retries)
          const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
          console.warn(`Quota exceeded. Retrying in ${Math.round(backoffTime / 1000)}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(backoffTime);
        }
      } else {
        // If the error is not a retriable quota error, throw it immediately.
        throw error;
      }
    }
  }

  // If all retries have been exhausted, throw the last captured error.
  console.error(`Final attempt failed after ${MAX_RETRIES} retries.`);
  throw lastError;
}


const plotSchema = {
    type: Type.OBJECT,
    properties: {
        chart_type: {
            type: Type.STRING,
            description: "The type of chart to render.",
            enum: ['bar', 'line', 'pie', 'scatter'],
        },
        title: { type: Type.STRING, description: "A descriptive title for the chart." },
        description: { type: Type.STRING, description: "A brief explanation of what the chart shows." },
        data: {
            type: Type.ARRAY,
            description: "Data for the plot, formatted as an array of arrays. The first inner array is the header row (column names). Subsequent inner arrays are data rows. All individual cell values must be represented as strings.",
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                    description: "A single data cell value, represented as a string.",
                }
            }
        },
        data_keys: {
            type: Type.OBJECT,
            description: "The keys to use for plotting from the 'data' array.",
            properties: {
                x: { type: Type.STRING, description: "The key for the x-axis or labels." },
                y: {
                    type: Type.ARRAY,
                    description: "The key(s) for the y-axis or values. Always an array.",
                    items: { type: Type.STRING },
                },
                 name: { type: Type.STRING, description: "The key for pie chart slice names." },
                 value: { type: Type.STRING, description: "The key for pie chart slice values." },
            },
        },
    },
    required: ['chart_type', 'title', 'description', 'data', 'data_keys'],
};

// The schema to enforce for Gemini's JSON output for full analysis.
const analysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        inspection_summary: {
            type: Type.OBJECT,
            description: "A summary of the dataset's structure.",
            properties: {
                rows: { type: Type.NUMBER, description: "Total number of rows." },
                columns: { type: Type.NUMBER, description: "Total number of columns." },
                column_details: {
                    type: Type.ARRAY,
                    description: "Details for each column.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Column name." },
                            type: { type: Type.STRING, description: "Inferred data type (e.g., 'numerical', 'categorical')." },
                            missing_values: { type: Type.NUMBER, description: "Count of missing values." },
                        },
                        required: ['name', 'type', 'missing_values'],
                    },
                },
            },
            required: ['rows', 'columns', 'column_details'],
        },
        findings: {
            type: Type.ARRAY,
            description: "A list of key findings. Each finding is a self-contained unit with a textual insight and an optional, directly related plot.",
            items: {
                type: Type.OBJECT,
                properties: {
                    insight: {
                        type: Type.STRING,
                        description: "A concise, actionable insight that tells a story about the data, directly addressing the user's query."
                    },
                    plot: {
                        ...plotSchema,
                        description: "A visualization that directly supports and illustrates the accompanying insight. This is optional."
                    }
                },
                required: ["insight"]
            }
        },
    },
    required: ['inspection_summary', 'findings'],
};

// FIX: Adding a new schema for the pre-analysis step.
const preAnalysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "A brief, one-paragraph summary of the dataset based on its headers and first few rows. Mention the likely topic and what it contains."
        },
        suggestedQuestions: {
            type: Type.ARRAY,
            description: "A list of 3-4 insightful questions a user might want to ask about this data to start an analysis.",
            items: { type: Type.STRING },
        }
    },
    required: ['summary', 'suggestedQuestions'],
};


/**
 * Reads a File object and returns its content as a string.
 */
const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Generates a prompt for the full analysis.
 */
const generatePrompt = (csvContent: string, userPrompt: string, history?: string): string => {
    const historySection = history ? `
      ---
      **CONTEXTO DA CONVERSA ANTERIOR (Use para contexto, mas foque na nova solicitação):**
      ${history}
      ---
    ` : '';
    
    return `
      **Sua Persona: Contadora de Histórias de Dados (Data Storyteller)**
      Você é uma especialista em dados de elite. Sua missão não é apenas analisar, mas encontrar a *narrativa* mais convincente e impactante nos dados que responda diretamente à pergunta do usuário. Quantifique suas descobertas sempre que possível. Vá além do óbvio.

      **Idioma de Saída:** Todo o texto gerado DEVE ser em português do Brasil.

      **Processo de Análise (Seu Processo de Pensamento):**
      1.  **Formule uma Hipótese:** Com base na pergunta do usuário, qual é a sua hipótese inicial? (Ex: "Minha hipótese é que as campanhas de marketing em redes sociais têm um ROI maior do que as de e-mail.")
      2.  **Busque Evidências:** Analise o CONJUNTO DE DADOS COMPLETO para encontrar evidências que suportem ou refutem sua hipótese. Procure por correlações, anomalias, tendências e segmentações.
      3.  **Construa a Narrativa:** Apresente suas conclusões como "achados". Cada "achado" deve ser uma peça da história. Comece com a conclusão principal e depois forneça os detalhes.
      4.  **Explique o "Porquê":** Para cada achado, explique *por que* ele é significativo. Qual é a implicação de negócio? (Ex: "A queda de 20% nas vendas no Produto Y, apesar do aumento do tráfego, sugere um problema de precificação ou usabilidade na página do produto.")
      5.  **Visualize a Evidência:** Para cada achado textual, se uma visualização puder provar seu ponto de forma mais eficaz, crie um gráfico. O gráfico deve ser a evidência visual direta do seu insight. O título e a descrição do gráfico devem reforçar a conclusão do achado.

      ${historySection}
      
      **Amostra de Dados CSV (primeiras 50 linhas apenas para contexto estrutural):**
      \`\`\`csv
      ${csvContent.split('\n').slice(0, 50).join('\n')}
      \`\`\`
      
      **Nova Solicitação do Usuário (Prioridade Máxima):**
      "${userPrompt}"
      
      **Sua Tarefa:**
      Execute seu processo de análise para responder à nova solicitação do usuário. Gere um perfil dos dados e uma lista de "achados" coerentes.

      **REGRAS CRÍTICAS DE SAÍDA JSON:**
      1.  Responda **estritamente** no formato JSON definido pelo esquema. NENHUM texto fora do objeto JSON principal.
      2.  A resposta deve ter uma chave 'inspection_summary' e uma chave 'findings'.
      3.  'findings' é um array. Cada item no array deve ter uma chave 'insight' (string) e pode ter uma chave opcional 'plot'.
      4.  **Se você gerar um 'plot', ele DEVE corresponder diretamente ao 'insight' que o acompanha.**
      5.  Para 'plot.data', o primeiro array interno é o cabeçalho. Todos os valores das células DEVEM ser strings. Ex: [["Mês", "Vendas"], ["Jan", "1500"], ["Fev", "1800"]].
      6.  Para 'plot.data_keys.y', **sempre** use um array de strings, mesmo com uma única série. Ex: \`"y": ["Vendas"]\`.
    `;
};

// FIX: Adding a new prompt generator for the pre-analysis step.
const generatePreAnalysisPrompt = (csvContent: string): string => {
    return `
      Você é um assistente de IA projetado para reconhecimento rápido de dados.
      Sua tarefa é realizar uma pré-análise de alto nível e muito rápida dos dados CSV fornecidos.
      Não realize uma análise completa. Olhe apenas para os cabeçalhos e as primeiras 10-20 linhas para entender a estrutura e o tópico dos dados.

      **Idioma de Saída:** Todo o texto gerado (resumo, perguntas) DEVE ser em português do Brasil.

      **Amostra de Dados CSV (primeiras 20 linhas para contexto):**
      \`\`\`csv
      ${csvContent.split('\n').slice(0, 20).join('\n')}
      \`\`\`
      
      **Sua Tarefa:**
      1.  **Resumo Rápido:** Em um parágrafo, resuma sobre o que provavelmente é este conjunto de dados. Com base nos nomes das colunas, qual é o seu propósito principal? Mencione quaisquer problemas de qualidade de dados imediatamente óbvios (por exemplo, muitos valores vazios em uma coluna crítica).
      2.  **Perguntas Estratégicas:** Gere de 3 a 4 perguntas estratégicas e perspicazes que um analista de negócios ou pesquisador faria. Essas perguntas devem ir além de consultas simples e sugerir potenciais caminhos para análises valiosas. Por exemplo, em vez de "Qual é a venda média?", sugira "Qual segmento de cliente tem o maior valor vitalício e quais são seus padrões de compra comuns?".
      3.  **Saída JSON Estrita:** Responda **estritamente** no formato JSON definido pelo esquema fornecido. Não inclua nenhum texto, formatação markdown ou blocos de código fora do objeto JSON principal.
    `;
};


/**
 * Calls the Gemini API with a specific prompt and returns a structured AnalysisResult.
 */
const callGemini = async (prompt: string): Promise<AnalysisResult> => {
    let result: AnalysisResult;
    try {
        const response = await callApiWithRetry(() => 
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: analysisResultSchema,
                    temperature: 0.1, // Lower temperature for more deterministic, factual responses
                }
            })
        );
        
        // FIX: Cast the response to GenerateContentResponse to ensure type safety, as type inference may fail.
        const jsonText = (response as GenerateContentResponse).text.trim();
        result = JSON.parse(jsonText) as AnalysisResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        // Enhance error message for common issues
        if (errorMessage.includes('API key not valid')) {
            throw new GeminiApiError('A chave da API fornecida é inválida. Verifique sua configuração.');
        }
        if (errorMessage.includes('quota')) {
            throw new GeminiApiError('A cota de uso da API foi excedida. Por favor, tente novamente mais tarde.');
        }
        throw new GeminiApiError(`Falha ao obter análise do Gemini. Causa: ${errorMessage}`);
    }

    try {
        // Helper function to convert array of arrays to array of objects for recharts
        const convertData = (data: any[][]): Record<string, any>[] => {
            if (!Array.isArray(data) || data.length < 2) return [];
            const headers = data[0].map(h => String(h));
            return data.slice(1).map(row => {
                const obj: Record<string, any> = {};
                headers.forEach((header, index) => {
                    const value = row[index];
                    // Handle non-string values like null, or numbers if the model sends them anyway
                    if (typeof value !== 'string') {
                      obj[header] = value;
                      return;
                    }
                    const trimmedValue = value.trim();
                    // Check for empty string and if the string is a valid number representation
                    if (trimmedValue !== '' && !isNaN(Number(trimmedValue))) {
                        obj[header] = Number(trimmedValue);
                    } else {
                        obj[header] = value; // Keep original string if not a number or if it's empty
                    }
                });
                return obj;
            });
        };
        
        // Post-process the plot data from an array of arrays to an array of objects
        if (result.findings && Array.isArray(result.findings)) {
             result.findings.forEach((finding: Finding) => {
                if (finding.plot && Array.isArray(finding.plot.data) && finding.plot.data.length > 0 && Array.isArray(finding.plot.data[0])) {
                    finding.plot.data = convertData(finding.plot.data as any[][]);
                }
            });
        }
        return result;
    } catch (error) {
        console.error("Failed to parse plot data:", error);
        throw new DataParsingError("A IA retornou dados de visualização em um formato que não pôde ser processado.");
    }
};

// FIX: Adding a new Gemini caller specifically for the pre-analysis step.
const callGeminiForPreAnalysis = async (prompt: string): Promise<PreAnalysisResult> => {
     try {
        const response = await callApiWithRetry(() => 
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: preAnalysisResultSchema,
                    temperature: 0.3, // Higher temp for more creative questions
                }
            })
        );
        
        // FIX: Cast the response to GenerateContentResponse to ensure type safety, as type inference may fail.
        const jsonText = (response as GenerateContentResponse).text.trim();
        return JSON.parse(jsonText) as PreAnalysisResult;
    } catch (error) {
        console.error("Error calling Gemini API for pre-analysis:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        if (errorMessage.includes('API key not valid')) {
            throw new GeminiApiError('A chave da API fornecida é inválida. Verifique sua configuração.');
        }
        if (errorMessage.includes('quota')) {
            throw new GeminiApiError('A cota de uso da API foi excedida. Por favor, tente novamente mais tarde.');
        }
        throw new GeminiApiError(`Falha ao obter pré-análise do Gemini. Causa: ${errorMessage}`);
    }
};


// FIX: Adding the new performPreAnalysis function.
/**
 * Performs a quick pre-analysis to get a summary and suggested questions.
 */
export const performPreAnalysis = async (file: File): Promise<PreAnalysisResult> => {
    const csvContent = await fileToText(file);
    const prompt = generatePreAnalysisPrompt(csvContent);
    return callGeminiForPreAnalysis(prompt);
};


// FIX: Updating performInitialAnalysis to accept a question.
/**
 * Performs the initial, comprehensive analysis of a CSV file based on a user-selected question.
 */
export const performInitialAnalysis = async (file: File, question: string): Promise<AnalysisResult> => {
    const csvContent = await fileToText(file);
    const prompt = generatePrompt(csvContent, question);
    return callGemini(prompt);
};

/**
 * Handles follow-up questions in the chat, using conversation history for context.
 */
export const getChatResponse = async (file: File, history: string, userMessage: string): Promise<AnalysisResult> => {
    const csvContent = await fileToText(file);
    const prompt = generatePrompt(csvContent, userMessage, history);
    return callGemini(prompt);
};
