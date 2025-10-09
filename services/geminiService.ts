// FIX: Implement geminiService to provide AI-powered data analysis capabilities.
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, DataProfile, PreAnalysisResult } from '../types';
import { GeminiApiError, DataParsingError } from './errors';

// FIX: Initialize the GoogleGenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const JSON_RESPONSE_INSTRUCTIONS = `
Responda SEMPRE com um objeto JSON válido. Não inclua markdown (ou seja, \`\`\`json).
O JSON deve estar estritamente em conformidade com o schema fornecido.
`;

const analysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        findings: {
            type: Type.ARRAY,
            description: "Lista de descobertas (insights) da análise. Cada descoberta deve incluir um insight textual e, opcionalmente, uma especificação de gráfico.",
            items: {
                type: Type.OBJECT,
                properties: {
                    insight: {
                        type: Type.STRING,
                        description: "Uma descrição textual concisa e acionável da descoberta. Explique o que o gráfico mostra e o que isso significa no contexto dos dados."
                    },
                    plot: {
                        type: Type.OBJECT,
                        description: "Especificação para visualização do gráfico. Omitir se a descoberta não puder ser visualizada.",
                        properties: {
                            chart_type: { type: Type.STRING, enum: ['bar', 'line', 'scatter', 'pie'], description: "Tipo de gráfico." },
                            title: { type: Type.STRING, description: "Título descritivo para o gráfico." },
                            description: { type: Type.STRING, description: "Breve descrição do que o gráfico representa." },
                            data: { 
                                type: Type.STRING, 
                                description: "Uma string JSON representando os dados para o gráfico, formatada como um array de arrays. A primeira linha DEVE ser o cabeçalho. Exemplo: '[[\"Mês\",\"Vendas\"],[\"Jan\",150],[\"Fev\",200]]'"
                            },
                            data_keys: {
                                type: Type.OBJECT,
                                description: "Mapeamento das chaves de dados para os eixos do gráfico. As chaves devem corresponder aos cabeçalhos na primeira linha do campo 'data'.",
                                properties: {
                                    x: { type: Type.STRING, description: "Chave de dados para o eixo X (ou rótulos)." },
                                    y: { type: Type.ARRAY, description: "Chave(s) de dados para o eixo Y (valores).", items: {type: Type.STRING}},
                                    value: { type: Type.STRING, description: "Chave para valores (usado em gráficos de pizza)." },
                                    name: { type: Type.STRING, description: "Chave para nomes/categorias (usado em gráficos de pizza)." }
                                }
                            }
                        }
                    }
                },
                required: ["insight"]
            }
        },
        suggested_followups: {
            type: Type.ARRAY,
            description: "Uma lista de 3-5 perguntas de acompanhamento sugeridas que o usuário poderia fazer para aprofundar a análise.",
            items: { type: Type.STRING }
        }
    },
    required: ["findings", "suggested_followups"]
};

const preAnalysisResultSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Um resumo conciso de 1-2 frases sobre o conteúdo geral do conjunto de dados."
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      description: "Uma lista de 3-4 perguntas iniciais interessantes que podem ser respondidas com base no perfil de dados fornecido.",
      items: { type: Type.STRING }
    }
  },
  required: ["summary", "suggestedQuestions"]
};


const parseJsonResponse = <T>(jsonString: string, title: string): T => {
    try {
        const cleanedJsonString = jsonString.replace(/^```json\s*|```\s*$/g, '').trim();
        return JSON.parse(cleanedJsonString);
    } catch (error) {
        console.error("Falha ao analisar a resposta JSON:", error, "String original:", jsonString);
        throw new DataParsingError(
          "A IA retornou uma resposta em um formato inesperado. Por favor, tente refazer sua pergunta.",
          title
        );
    }
};

const processAnalysisResult = (rawResult: any): AnalysisResult => {
    if (rawResult.findings) {
        for (const finding of rawResult.findings) {
            if (finding.plot && typeof finding.plot.data === 'string') {
                try {
                    // First, parse the JSON string into an array of arrays
                    finding.plot.data = JSON.parse(finding.plot.data);
                } catch (e) {
                    console.error("Falha ao analisar a string JSON de plot.data:", e);
                    finding.plot.data = []; // Clear data on parsing error
                }
            }

            if (finding.plot && Array.isArray(finding.plot.data) && finding.plot.data.length > 1) {
                const rawData: any[][] = finding.plot.data;
                const header: string[] = rawData[0].map(h => String(h));
                const rows = rawData.slice(1);
                
                const formattedData: Record<string, any>[] = rows.map(row => {
                    const obj: Record<string, any> = {};
                    header.forEach((key, index) => {
                        obj[key] = row[index];
                    });
                    return obj;
                });
                
                finding.plot.data = formattedData;
            } else if (finding.plot) {
                 // If data is invalid, not an array, or empty after parsing, nullify it to avoid render errors
                finding.plot.data = [];
            }
        }
    }
    return rawResult as AnalysisResult;
};


export const getPreAnalysis = async (dataProfile: DataProfile, sampleData: string): Promise<PreAnalysisResult> => {
  const prompt = `
    Você é um assistente de análise de dados. Um usuário acabou de carregar um arquivo de dados.
    Abaixo estão o perfil dos dados e uma amostra das primeiras linhas.
    Sua tarefa é fornecer um resumo muito breve do conjunto de dados e sugerir 3-4 perguntas iniciais interessantes que o usuário poderia fazer para iniciar a análise.

    Perfil dos Dados:
    ${JSON.stringify(dataProfile, null, 2)}

    Amostra de Dados (formato CSV):
    ${sampleData}

    Responda em português brasileiro.
    ${JSON_RESPONSE_INSTRUCTIONS}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: preAnalysisResultSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
        throw new GeminiApiError("A resposta da API estava vazia.");
    }
    return parseJsonResponse<PreAnalysisResult>(jsonText, "Erro na Pré-Análise");

  } catch (error) {
    console.error("Erro da API Gemini na pré-análise:", error);
    if (error instanceof DataParsingError) throw error;
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new GeminiApiError(`Não foi possível gerar a pré-análise. Detalhes: ${errorMessage}`);
  }
};


export const getAnalysis = async (
    dataProfile: DataProfile,
    fullDataSample: string,
    question: string,
    chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[]
): Promise<AnalysisResult> => {
    
    const historyString = chatHistory.map(turn => `${turn.role}: ${turn.parts[0].text}`).join('\n');

    const prompt = `
      Você é um analista de dados especialista. Sua tarefa é analisar o conjunto de dados fornecido para responder à pergunta do usuário.
      Forneça insights acionáveis e crie visualizações claras quando apropriado.

      **Contexto:**
      - **Perfil dos Dados:** ${JSON.stringify(dataProfile, null, 2)}
      - **Histórico da Conversa:**
      ${historyString}
      - **Pergunta Atual do Usuário:** "${question}"

      **Dados (amostra em formato CSV):**
      \`\`\`csv
      ${fullDataSample}
      \`\`\`

      **Instruções:**
      1.  **Analise:** Com base na pergunta do usuário, no perfil dos dados e no histórico, analise os dados fornecidos.
      2.  **Gere Insights:** Formule de 1 a 3 descobertas (findings) principais que respondam diretamente à pergunta.
      3.  **Crie Gráficos:** Para cada descoberta que possa ser visualizada, crie uma especificação de gráfico ('plot').
          - Use o tipo de gráfico mais apropriado ('bar', 'line', 'scatter', 'pie').
          - Mantenha os gráficos simples e fáceis de entender.
          - Se os dados precisarem de agregação (soma, média, contagem), realize-a e coloque os dados agregados na propriedade 'data' do gráfico.
          - **IMPORTANTE:** O campo 'data' na especificação do gráfico DEVE ser uma string JSON representando um array de arrays. A primeira linha DEVE ser o cabeçalho (ex: '[[\"Cidade\", \"Vendas\"]]'). As linhas subsequentes contêm os dados.
      4.  **Sugira Próximos Passos:** Forneça 3-5 perguntas de acompanhamento ('suggested_followups') que incentivem uma exploração mais profunda.

      Responda em português brasileiro.
      ${JSON_RESPONSE_INSTRUCTIONS}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisResultSchema,
            temperature: 0.3,
        }
      });

      const jsonText = response.text;
      if (!jsonText) {
          throw new GeminiApiError("A resposta da API estava vazia.");
      }
      const rawResult = parseJsonResponse<any>(jsonText, "Erro na Análise");
      return processAnalysisResult(rawResult);

    } catch (error) {
      console.error("Erro da API Gemini na análise:", error);
      if (error instanceof DataParsingError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GeminiApiError(`Não foi possível obter a análise. Por favor, tente novamente. Detalhes: ${errorMessage}`);
    }
};