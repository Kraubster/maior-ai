// services/aiServiceRouter.ts

import { Message, AppMode } from '../types';

// 1. Importa os serviços REAIS e muda-lhes o nome
import { generateResponse as geminiGenerate } from './geminiService';
import { generateResponse as groqGenerate } from './groqService'; // O nosso novo backup!

// Define os parâmetros (a "interface" pública do nosso router)
interface GenerateParams {
  prompt: string;
  imageBase64?: string;
  mode: AppMode;
  previousMessages: Message[];
}

/**
 * Esta é a nossa "Central de Comando" (Router/Facade).
 * O App.tsx chama esta função, e esta decide qual IA usar.
 */
export const generateResponse = async (params: GenerateParams): Promise<{ text: string; sources?: { uri: string; title: string }[] }> => {
  
  // --- LÓGICA DE DECISÃO (O CÉREBRO) ---

  // 1. Caso Especial: MODO GIGA
  // Se for GIGA, o utilizador pediu potência máxima.
  // Vamos diretos ao Gemini 2.5 Pro (o geminiService já trata disto).
  if (params.mode === 'giga') {
    console.log("Routing: 🧠 Modo GIGA detetado. A chamar Gemini Pro.");
    return geminiGenerate(params);
  }

  // 2. Caso Especial: MODO TIRA 20s (Imagem)
  // Se houver uma imagem, o Groq não a suporta.
  // Temos de usar o Gemini (que usará o Flash multimodal).
  if (params.imageBase64) {
    console.log("Routing: 🖼️ Imagem detetada. A chamar Gemini Flash (Multimodal).");
    return geminiGenerate(params);
  }

  // 3. Caso Padrão: CADEIA DE FAILOVER (Só Texto)
  // O utilizador fez um pedido de texto normal.
  console.log("Routing: 💬 Pedido de texto. A tentar Gemini Flash primeiro...");
  
  try {
    // TENTATIVA 1: Gemini 2.5 Flash (Rápido, Gratuito, Grounding)
    const geminiResponse = await geminiGenerate(params);
    return geminiResponse;

  } catch (geminiError) {
    console.error("Falha no Serviço Primário (Gemini):", geminiError);
    console.warn("FAILOVER: ⚡ A tentar serviço secundário (Groq)...");

    try {
      // TENTATIVA 2: Groq (Mistral/Llama) (Ultra-rápido, Gratuito, Backup)
      const groqResponse = await groqGenerate(params);
      
      // Adiciona uma nota para sabermos que é o backup
      return { 
        ...groqResponse, 
        text: `(Resposta via Groq ⚡)\n\n${groqResponse.text}` 
      };

    } catch (groqError) {
      console.error("Falha no Serviço Secundário (Groq):", groqError);
      
      // Se ambos falharem, devolve um erro final ao utilizador.
      return { text: "Ocorreu um erro crítico. Ambos os serviços de IA (Gemini e Groq) falharam. Por favor, tenta novamente mais tarde." };
    }
  }
};
