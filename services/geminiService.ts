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
        suggested_followups: {
            type: Type.ARRAY,
            description: "A list of 2-3 relevant follow-up questions a user might ask to dig deeper into these findings.",
            items: { type: Type.STRING }
        }
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

// Schema for the conversation summary
const summarySchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "A concise summary of the conversation, preserving key data insights, entities, and user intents."
        }
    },
    required: ['summary'],
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
const generatePrompt = (csvContent: string, userPrompt: string, history?: string, summary?: string): string => {
    const summarySection = summary ? `
      ---
      **RESUMO DA CONVERSA ATÉ AGORA (Use este como o contexto principal de longo prazo):**
      ${summary}
      ---
    ` : '';
    
    const historySection = history ? `
      ---
      **HISTÓRICO RECENTE DA CONVERSA (Use para entender o contexto imediato):**
      ${history}
      ---
    ` : '';
    
    return `
      **Sua Persona: Contadora de Histórias de Dados (Data Storyteller) de Elite**
      Você é uma analista de dados sênior com um talento especial para transformar números brutos em narrativas de negócios convincentes. Sua missão é ir além da análise superficial, descobrindo os insights acionáveis que impulsionam decisões estratégicas. Quantifique tudo e sempre explique o "porquê" por trás dos dados.

      **Idioma de Saída:** Todo o texto gerado DEVE ser em português do Brasil.

      **Processo de Análise (Seu Processo de Pensamento):**
      1.  **Hipótese Orientada à Ação:** Com base na pergunta do usuário, formule uma hipótese de negócio. (Ex: "Acredito que os clientes que compram o Produto A têm uma probabilidade 3x maior de se tornarem clientes recorrentes.")
      2.  **Investigação Profunda:** Analise o CONJUNTO DE DADOS COMPLETO. Procure por correlações, anomalias, tendências e segmentações que confirmem ou refutem sua hipótese. Destaque ativamente quaisquer outliers ou padrões inesperados que possam indicar um risco ou uma oportunidade.
      3.  **Construção da Narrativa:** Apresente suas conclusões como "achados". Cada achado é um capítulo da história. Comece com a conclusão mais impactante. (Ex: "O principal motor de receita não são os novos clientes, mas sim um pequeno grupo de clientes fiéis com um LTV 500% maior que a média.")
      4.  **Explique a Relevância (O "E Daí?"):** Para cada achado, responda à pergunta "E daí?". Qual é a implicação de negócio? (Ex: "A descoberta de que 80% das vendas vêm de 20% dos clientes sugere que uma estratégia de marketing focada na retenção e em programas de fidelidade pode ter um ROI significativamente maior do que a aquisição de novos clientes.")
      5.  **Visualização como Evidência:** Se um gráfico puder provar seu ponto de forma irrefutável, crie um. O título do gráfico deve ser a própria conclusão. (Ex: "Gráfico de Pareto: 80% da Receita Concentrada em 20% dos Clientes").
      6.  **Recomendações Estratégicas:** Com base em sua análise, gere 2-3 perguntas de acompanhamento que levem a decisões de negócios. (Ex: "Quais são as características demográficas comuns desses 20% de clientes de alto valor?" ou "Podemos criar uma campanha de marketing direcionada para clientes com perfis semelhantes?").

      ${summarySection}
      ${historySection}
      
      **Amostra de Dados CSV (primeiras 50 linhas apenas para contexto estrutural):**
      \`\`\`csv
      ${csvContent.split('\n').slice(0, 50).join('\n')}
      \`\`\`
      
      **Nova Solicitação do Usuário (Prioridade Máxima):**
      "${userPrompt}"
      
      **Sua Tarefa:**
      Execute seu processo de análise para responder à nova solicitação do usuário. Gere um perfil dos dados, uma lista de "achados" coerentes e as perguntas de acompanhamento.

      **REGRAS CRÍTICAS DE SAÍDA JSON:**
      1.  Responda **estritamente** no formato JSON definido pelo esquema. NENHUM texto fora do objeto JSON principal.
      2.  A resposta deve ter uma chave 'inspection_summary' e uma chave 'findings'.
      3.  'findings' é um array. Cada item no array deve ter uma chave 'insight' (string) e pode ter uma chave opcional 'plot'.
      4.  **Se você gerar um 'plot', ele DEVE corresponder diretamente ao 'insight' que o acompanha.**
      5.  Para 'plot.data', o primeiro array interno é o cabeçalho. Todos os valores das células DEVEM ser strings. Ex: [["Mês", "Vendas"], ["Jan", "1500"], ["Fev", "1800"]].
      6.  Para 'plot.data_keys.y', **sempre** use um array de strings, mesmo com uma única série. Ex: \`"y": ["Vendas"]\`.
      7.  Inclua a chave opcional 'suggested_followups' com um array de 2-3 perguntas de acompanhamento relevantes, se aplicável.
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

const generateSummaryPrompt = (history: string): string => {
    return `
      **Sua Tarefa:** Você é um Agente de Resumo. Seu trabalho é criar um resumo conciso da seguinte conversa de análise de dados.
      
      **Instruções:**
      1.  Extraia os principais insights, achados e conclusões que foram discutidos.
      2.  Mencione quaisquer pontos de dados ou métricas específicas que foram importantes.
      3.  Capture o fio principal da investigação do usuário.
      4.  O resultado deve ser um parágrafo denso e rico em informações.
      5.  Responda APENAS com o objeto JSON conforme definido pelo esquema. Nenhum outro texto.
      
      **Conversa para Resumir:**
      ---
      ${history}
      ---
    `;
};

/**
 * Summarizes a conversation history.
 */
export const summarizeConversation = async (history: string): Promise<string> => {
    const prompt = generateSummaryPrompt(history);
    try {
        const response = await callApiWithRetry(() => 
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: summarySchema,
                    temperature: 0.0,
                }
            })
        );
        const jsonText = (response as GenerateContentResponse).text.trim();
        const result = JSON.parse(jsonText);
        return result.summary || "";

    } catch (error) {
        console.error("Error summarizing conversation:", error);
        return ""; // Return empty string on failure to not crash the app
    }
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
 * Handles follow-up questions in the chat, using conversation history for context and streaming the response.
 */
export const getChatResponseStream = async (file: File, history: string, userMessage: string, summary: string): Promise<AsyncGenerator<string>> => {
    const csvContent = await fileToText(file);
    const prompt = generatePrompt(csvContent, userMessage, history, summary);
    
    try {
      const responseStream = await callApiWithRetry(() =>
        ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisResultSchema,
                temperature: 0.1,
            }
        })
      );
      
      // Return the async generator directly
      return (async function*() {
        // FIX: Cast responseStream to an async generator of GenerateContentResponse to fix
        // an issue where its type was inferred as 'unknown', causing an iteration error.
        for await (const chunk of responseStream as AsyncGenerator<GenerateContentResponse>) {
          yield chunk.text;
        }
      })();

    } catch (error) {
        console.error("Error calling Gemini API Stream:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        if (errorMessage.includes('API key not valid')) {
            throw new GeminiApiError('A chave da API fornecida é inválida. Verifique sua configuração.');
        }
        if (errorMessage.includes('quota')) {
            throw new GeminiApiError('A cota de uso da API foi excedida. Por favor, tente novamente mais tarde.');
        }
        throw new GeminiApiError(`Falha ao obter análise do Gemini. Causa: ${errorMessage}`);
    }
};