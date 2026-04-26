/**
 * Orchestrateur Multi-Modèles pour QGISAI+
 * 
 * Architecture:
 * 1. Phase 1: Analyse d'intention (modèle ultra-léger local)
 * 2. Phase 2: Planification (si complexe)
 * 3. Phase 3: Exécution avec le modèle approprié
 */

import { ChatConversation, ConversationMode } from "./chat-history";
import { analyzeUserIntent, IntentAnalysis, selectModelForIntent, canUseLocalRouter, shouldUseStreaming } from "./prompt-intelligence";
import { tryHandleLocalIntent } from "./local-intent-router";
import { getOllamaModels, detectOllama } from "./ollama-auto-detect";
import { AppSettings } from "./settings";
import { executeQgisToolCall, getOpenAiQgisToolDefinitions } from "./qgis-tools";
import { getLayersCatalog, getSystemSpecs } from "./qgis";
import { appendDebugEvent } from "./debug-log";
import { toast } from "sonner";
import { useThinkingStore } from "../stores/useThinkingStore";

export interface OrchestratorResult {
  success: boolean;
  response: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: Record<string, unknown>;
  }>;
  codeGenerated?: string;
  executionTimeMs: number;
  modelUsed?: string;
  approach: "LOCAL_ROUTER" | "TOOL_CALLING" | "CODE_GENERATION" | "HYBRID" | "DIRECT_LLM";
}

interface ExecutionPlan {
  steps: ExecutionStep[];
  contextNeeded: string[];
  estimatedTokens: number;
}

interface ExecutionStep {
  id: number;
  description: string;
  tool?: string;
  dependsOn?: number[];
  canParallelize: boolean;
}

/**
 * Orchestrateur principal: analyse → planifie → exécute
 */
export async function orchestrateResponse(
  conversation: ChatConversation,
  latestUserMessage: string,
  settings: AppSettings,
  mode: ConversationMode,
  signal?: AbortSignal
): Promise<OrchestratorResult> {
  const startTime = performance.now();
  
  appendDebugEvent({
    level: "info",
    source: "orchestrator",
    title: "Démarrage orchestration",
    message: `Analyse de: "${latestUserMessage.slice(0, 100)}..."`,
  });

  // === PHASE 1: Analyse d'intention (modèle ultra-léger) ===
  useThinkingStore.getState().setPhase("ANALYZING_INTENT");
  toast.info("Analyse de votre demande...", { duration: 1500 });
  
  const intentAnalysis = await analyzeUserIntent(latestUserMessage, settings);
  
  if (!intentAnalysis) {
    // Fallback sur le traitement direct
    return handleDirectLLM(conversation, latestUserMessage, settings, signal, startTime);
  }

  appendDebugEvent({
    level: "info",
    source: "orchestrator",
    title: "Intention analysée",
    message: `${intentAnalysis.intent} | ${intentAnalysis.complexity} | confiance: ${Math.round(intentAnalysis.confidence * 100)}%`,
    details: `Approche: ${intentAnalysis.suggestedApproach}\nÉtapes estimées: ${intentAnalysis.estimatedSteps}`,
  });

  // === PHASE 2: Routage selon l'intention ===
  useThinkingStore.getState().setPhase("SELECTING_MODEL", {
    modelName: intentAnalysis.suggestedModelTier,
  });
  
  // 2A: Actions simples → Local Router (réponse immédiate)
  if (mode === "chat" && canUseLocalRouter(intentAnalysis)) {
    const localResult = await tryHandleLocalIntent(latestUserMessage, mode);
    if (localResult.handled) {
      return {
        success: true,
        response: localResult.response || "",
        approach: "LOCAL_ROUTER",
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  // 2B: Explications simples → LLM léger direct
  if (intentAnalysis.intent === "EXPLANATION" || intentAnalysis.intent === "FREE_CHAT") {
    return handleDirectLLM(conversation, latestUserMessage, settings, signal, startTime, intentAnalysis);
  }

  // 2C: Inventaire forestier → Traitement spécialisé avec outils dédiés
  if (intentAnalysis.intent === "FOREST_INVENTORY") {
    return handleForestInventory(latestUserMessage, intentAnalysis, settings, signal, startTime);
  }

  // 2D: Export de données → Traitement rapide
  if (intentAnalysis.intent === "EXPORT") {
    return handleExport(latestUserMessage, intentAnalysis, settings, signal, startTime);
  }

  // 2E: Tâches complexes → Planification et exécution multi-étapes
  if (intentAnalysis.complexity === "COMPLEX" || intentAnalysis.complexity === "VERY_COMPLEX") {
    return handleComplexWorkflow(
      conversation,
      latestUserMessage,
      intentAnalysis,
      settings,
      signal,
      startTime
    );
  }

  // 2F: Actions modérées → Tool Calling ou Code Generation
  if (intentAnalysis.suggestedApproach === "TOOL_CALLING") {
    return handleToolCalling(latestUserMessage, intentAnalysis, settings, signal, startTime);
  }

  // Fallback: Code Generation (approche par défaut)
  return handleCodeGeneration(conversation, latestUserMessage, intentAnalysis, settings, signal, startTime);
}

/**
 * Gère les workflows complexes (planification + exécution)
 */
async function handleComplexWorkflow(
  conversation: ChatConversation,
  userMessage: string,
  analysis: IntentAnalysis,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();
  
  useThinkingStore.getState().setPhase("PLANNING");
  toast.info(`Planification d'un workflow de ${analysis.estimatedSteps} étapes...`, { duration: 2000 });

  // Récupérer le contexte QGIS si nécessaire
  let contextData: Record<string, unknown> = {};
  if (analysis.needsQgisContext) {
    useThinkingStore.getState().setPhase("RETRIEVING_CONTEXT");
    const [layers, specs] = await Promise.all([
      getLayersCatalog(),
      getSystemSpecs(),
    ]);
    contextData = {
      layers,
      systemSpecs: specs,
      layerNames: layers.map(l => l.name),
    };
  }

  // Générer le plan d'exécution avec un modèle léger
  const plan = await generateExecutionPlan(userMessage, analysis, contextData, settings);
  
  appendDebugEvent({
    level: "info",
    source: "orchestrator",
    title: "Plan généré",
    message: `${plan.steps.length} étapes planifiées`,
    details: plan.steps.map(s => `${s.id}. ${s.description}`).join("\n"),
  });

  // Exécuter le plan
  const results: OrchestratorResult["toolCalls"] = [];
  const completedSteps: number[] = [];

  useThinkingStore.getState().setPhase("EXECUTING_TOOLS");
  
  for (const step of plan.steps) {
    // Vérifier les dépendances
    if (step.dependsOn) {
      const depsMet = step.dependsOn.every(d => completedSteps.includes(d));
      if (!depsMet) {
        console.warn(`[Orchestrator] Dépendances non remplies pour l'étape ${step.id}`);
        continue;
      }
    }

    useThinkingStore.getState().updateSubMessage(`Étape ${step.id}/${plan.steps.length}: ${step.description}`);
    toast.info(`Exécution étape ${step.id}/${plan.steps.length}: ${step.description}`, { duration: 1500 });

    try {
      if (step.tool) {
        // Exécution d'outil
        const result = await executeQgisToolCall(step.tool, extractArgsForStep(step, contextData));
        results.push({ name: step.tool, args: extractArgsForStep(step, contextData), result });
        completedSteps.push(step.id);
      }
    } catch (error) {
      appendDebugEvent({
        level: "error",
        source: "orchestrator",
        title: `Échec étape ${step.id}`,
        message: String(error),
      });
    }
  }

  // Générer la réponse finale avec un modèle adapté
  const finalResponse = await generateWorkflowSummary(userMessage, plan, results, analysis, settings);

  return {
    success: true,
    response: finalResponse,
    toolCalls: results,
    approach: "HYBRID",
    executionTimeMs: performance.now() - start,
  };
}

/**
 * Génère un plan d'exécution avec un modèle léger
 */
async function generateExecutionPlan(
  userMessage: string,
  analysis: IntentAnalysis,
  contextData: Record<string, unknown>,
  settings: AppSettings
): Promise<ExecutionPlan> {
  
  const tools = getOpenAiQgisToolDefinitions();
  
  const planPrompt = `Tu es un planificateur de workflows SIG. Analyse la demande et génère un plan JSON.

Outils disponibles: ${tools.map(t => t.function.name).join(", ")}

Contexte: ${JSON.stringify(contextData, null, 2)}

Demande: "${userMessage}"

Analyse: ${analysis.intent} | ${analysis.complexity} | ${analysis.estimatedSteps} étapes

Génère un plan JSON:
{
  "steps": [
    {
      "id": 1,
      "description": "description courte",
      "tool": "nom_outil_optionnel",
      "dependsOn": [],
      "canParallelize": false
    }
  ],
  "contextNeeded": ["liste des données requises"],
  "estimatedTokens": 1000
}

Réponds UNIQUEMENT le JSON:`;

  try {
    const models = await getOllamaModels();
    const lightModel = models.find(m => 
      m.name.includes("4b") || m.name.includes("3b") || m.name.includes("gemma4:2b")
    )?.name || "gemma4:2b";

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: lightModel,
        prompt: planPrompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 1500 },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error("Failed to generate plan");

    const data = await response.json();
    const jsonMatch = data.response?.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: plan simple basé sur l'analyse
  }

  // Plan fallback
  return {
    steps: Array.from({ length: analysis.estimatedSteps }, (_, i) => ({
      id: i + 1,
      description: `Étape ${i + 1} du workflow ${analysis.intent}`,
      canParallelize: false,
    })),
    contextNeeded: analysis.entities.layers || [],
    estimatedTokens: 2000,
  };
}

/**
 * Gère l'appel d'outils structurés
 */
async function handleToolCalling(
  userMessage: string,
  analysis: IntentAnalysis,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();

  // Pour l'instant, fallback sur la génération de code
  // Le vrai tool calling avec OpenAI serait implémenté ici
  return handleCodeGeneration(
    { id: "temp", title: "Temp", messages: [{ id: "m1", role: "user", content: userMessage, createdAt: new Date().toISOString() }], mode: "chat", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), selectedLayerIds: [], layerContextById: {} },
    userMessage,
    analysis,
    settings,
    signal,
    start
  );
}

/**
 * Gère la génération de code PyQGIS
 */
async function handleCodeGeneration(
  conversation: ChatConversation,
  userMessage: string,
  analysis: IntentAnalysis,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();
  
  useThinkingStore.getState().setPhase("GENERATING_CODE");
  
  // Sélectionner le modèle approprié
  const ollamaModels = await getOllamaModels();
  const modelSelection = selectModelForIntent(analysis, ollamaModels.map(m => m.name), settings);

  useThinkingStore.getState().setPhase("WAITING_FOR_LLM", {
    modelName: modelSelection.model,
  });
  toast.info(`Génération de code avec ${modelSelection.model}...`, { duration: 2000 });

  // Appeler le LLM avec le modèle sélectionné
  const response = await generateWithOllama(
    modelSelection.model,
    buildCodeGenerationPrompt(userMessage, analysis),
    signal
  );

  // Extraire le code Python
  const codeMatch = response.match(/```python\n([\s\S]*?)\n```/);
  const code = codeMatch ? codeMatch[1] : response;

  appendDebugEvent({
    level: "success",
    source: "orchestrator",
    title: "Code généré",
    message: `${code.length} caractères avec ${modelSelection.model}`,
  });

  return {
    success: true,
    response: `J'ai généré un script PyQGIS pour réaliser cette tâche:\n\n\`\`\`python\n${code}\n\`\`\``, 
    codeGenerated: code,
    approach: "CODE_GENERATION",
    modelUsed: modelSelection.model,
    executionTimeMs: performance.now() - start,
  };
}

/**
 * Gère une réponse LLM directe (pour explications simples)
 */
async function handleDirectLLM(
  conversation: ChatConversation,
  userMessage: string,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number,
  analysis?: IntentAnalysis
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();
  
  useThinkingStore.getState().setPhase("WAITING_FOR_LLM");
  
  const ollamaModels = await getOllamaModels();
  const model = analysis ? 
    selectModelForIntent(analysis, ollamaModels.map(m => m.name), settings).model :
    (ollamaModels[0]?.name || "gemma4:4b");
  
  useThinkingStore.getState().setPhase("WAITING_FOR_LLM", {
    modelName: model,
  });

  const response = await generateWithOllama(
    model,
    `Tu es QGISAI+, expert SIG. Réponds en français de façon concise et précise.\n\n${userMessage}`,
    signal
  );

  return {
    success: true,
    response,
    approach: "DIRECT_LLM",
    modelUsed: model,
    executionTimeMs: performance.now() - start,
  };
}

/**
 * Génère un résumé du workflow exécuté
 */
async function generateWorkflowSummary(
  userMessage: string,
  plan: ExecutionPlan,
  results: OrchestratorResult["toolCalls"],
  analysis: IntentAnalysis,
  settings: AppSettings
): Promise<string> {
  const successCount = results?.length || 0;
  const totalSteps = plan.steps.length;
  
  let summary = `## Workflow exécuté (${successCount}/${totalSteps} étapes)\n\n`;
  
  if (results) {
    for (const call of results) {
      const success = call.result?.ok === true;
      summary += `- **${call.name}**: ${success ? "✅" : "❌"}\n`;
    }
  }
  
  summary += `\n*Exécution en ${analysis.suggestedModelTier} mode*`;
  
  return summary;
}

/**
 * Génère avec Ollama
 */
async function generateWithOllama(
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 2000 },
    }),
    signal: signal || AbortSignal.timeout(60000),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  
  const data = await response.json();
  return data.response || "";
}

/**
 * Construit le prompt pour la génération de code
 */
function buildCodeGenerationPrompt(userMessage: string, analysis: IntentAnalysis): string {
  return `Tu es un expert PyQGIS. Génère UN SEUL bloc de code Python complet pour QGIS.

RÈGLES ABSOLUES (OBLIGATOIRES - non respect = crash QGIS):
1. UN SEUL bloc \`\`\`python ... \`\`\`
2. Code auto-suffisant avec tous les imports
3. Gestion des erreurs avec try/except
4. Message de confirmation à la fin avec iface.messageBar()
5. Commentaires pour les étapes clés
6. ⛔ INTERDIT: exit(), quit(), sys.exit(), os._exit() - CES FONCTIONS TUENT QGIS !
7. ⛔ INTERDIT: N'invente PAS de fonctions (searchGeoApiCommunes, searchCadastreParcels, etc.)
8. ✅ UTILISE UNIQUEMENT: QgsProject, QgsVectorLayer, QgsRasterLayer, processing.run, iface.messageBar()
9. Pour les erreurs: try/except + iface.messageBar().pushWarning() - JAMAIS exit() !
10. Pour les reprojections: utilise processing.run("native:reprojectlayer", ...)

DEMANDE: ${userMessage}

ENTITÉS DÉTECTÉES:
- Communes: ${analysis.entities.communes?.join(", ") || "aucune"}
- Couches: ${analysis.entities.layers?.join(", ") || "à détecter"}
- Opérations: ${analysis.entities.operations?.join(", ") || "à déterminer"}

Génère le code:`;
}

/**
 * Gère les demandes d'inventaire forestier avec outils spécialisés
 */
async function handleForestInventory(
  userMessage: string,
  analysis: IntentAnalysis,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();
  
  toast.info("Préparation de l'inventaire forestier...", { duration: 2000 });
  
  // Sélectionner le modèle approprié
  const ollamaModels = await getOllamaModels();
  const modelSelection = selectModelForIntent(analysis, ollamaModels.map(m => m.name), settings);
  
  appendDebugEvent({
    level: "info",
    source: "orchestrator",
    title: "Inventaire forestier",
    message: `Demande: ${userMessage.slice(0, 80)}...`,
    details: `Modèle: ${modelSelection.model}\nEssences: ${analysis.entities.species?.join(", ") || "non spécifiées"}\nDistances: ${analysis.entities.distances?.join("m, ") || "non spécifiées"}m`,
  });
  
  // Construire un prompt spécialisé pour l'inventaire forestier
  const forestPrompt = `Tu es un expert en inventaire forestier et PyQGIS.

Demande: ${userMessage}

Contexte forestier détecté:
- Essences: ${analysis.entities.species?.join(", ") || "toutes essences"}
- Métriques demandées: ${analysis.entities.attributes?.join(", ") || "surface, densité"}
- Distances: ${analysis.entities.distances?.join("m, ") || "15"}m

Génère un script PyQGIS complet pour réaliser cet inventaire forestier.

RÈGLES ABSOLUES (OBLIGATOIRES - non respect = crash QGIS):
1. Utilise les algorithmes de grille (creategrid) pour les placettes
2. Calcule les métriques forestières (surface terrière, densité)
3. Gère les projections en Lambert 93 (EPSG:2154)
4. Ajoute des commentaires sur les méthodes forestières utilisées
5. Message de confirmation final avec les statistiques
6. ⛔ INTERDIT: exit(), quit(), sys.exit(), os._exit() - CES FONCTIONS TUENT QGIS !
7. ⛔ INTERDIT: N'invente PAS de fonctions inexistantes
8. Pour les erreurs: try/except + iface.messageBar().pushWarning() - JAMAIS exit() !

Génère le code:`;

  const response = await generateWithOllama(modelSelection.model, forestPrompt, signal);
  
  // Extraire le code Python
  const codeMatch = response.match(/```python\n([\s\S]*?)\n```/);
  const code = codeMatch ? codeMatch[1] : response;
  
  return {
    success: true,
    response: `**Inventaire forestier prêt à exécuter**

J'ai préparé un script pour réaliser cet inventaire avec les paramètres détectés:
- **Essences**: ${analysis.entities.species?.join(", ") || "toutes"}
- **Placettes**: Grille ${analysis.entities.distances?.[0] || 15}m
- **Métriques**: ${analysis.entities.attributes?.join(", ") || "surface"}

\`\`\`python
${code}
\`\`\``, 
    codeGenerated: code,
    approach: "CODE_GENERATION",
    modelUsed: modelSelection.model,
    executionTimeMs: performance.now() - start,
  };
}

/**
 * Gère les demandes d'export de données
 */
async function handleExport(
  userMessage: string,
  analysis: IntentAnalysis,
  settings: AppSettings,
  signal?: AbortSignal,
  startTime?: number
): Promise<OrchestratorResult> {
  const start = startTime || performance.now();
  
  const formats = analysis.entities.formats || ["GeoJSON"];
  const layers = analysis.entities.layers || [];
  const crs = analysis.entities.crs || "EPSG:2154";
  
  toast.info(`Export vers ${formats.join(", ")}...`, { duration: 2000 });
  
  appendDebugEvent({
    level: "info",
    source: "orchestrator",
    title: "Export de données",
    message: `Formats: ${formats.join(", ")}`,
    details: `Couches: ${layers.join(", ") || "toutes"}\nCRS: ${crs}`,
  });
  
  // Si une seule couche et format simple, générer code direct
  if (layers.length === 1 && formats.length === 1) {
    const exportPrompt = `Génère un script PyQGIS pour exporter une couche.

Couche: "${layers[0]}"
Format: ${formats[0].toUpperCase()}
CRS: ${crs}

RÈGLES:
1. Utiliser QgsVectorFileWriter pour l'export
2. Vérifier que la couche existe avant d'exporter
3. Message de confirmation avec le chemin de sortie
4. Gestion des erreurs avec try/except

Script:`;

    const ollamaModels = await getOllamaModels();
    const model = ollamaModels[0]?.name || "gemma4:4b";
    const response = await generateWithOllama(model, exportPrompt, signal);
    
    const codeMatch = response.match(/```python\n([\s\S]*?)\n```/);
    const code = codeMatch ? codeMatch[1] : response;
    
    return {
      success: true,
      response: `**Export ${formats[0].toUpperCase()} configuré**

Couche source: "${layers[0]}"\nCRS de sortie: ${crs}

\`\`\`python
${code}
\`\`\``, 
      codeGenerated: code,
      approach: "CODE_GENERATION",
      modelUsed: model,
      executionTimeMs: performance.now() - start,
    };
  }
  
  // Export multiple : utiliser handleToolCalling
  return handleToolCalling(userMessage, analysis, settings, signal, start);
}

/**
 * Extrait les arguments pour une étape
 */
function extractArgsForStep(step: ExecutionStep, context: Record<string, unknown>): Record<string, unknown> {
  // Logique simplifiée - à enrichir selon les besoins
  return {
    layerId: context.layerNames?.[0] || "",
    ...step,
  };
}
