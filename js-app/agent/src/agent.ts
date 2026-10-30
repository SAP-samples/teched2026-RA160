import { AIMessage } from '@langchain/core/messages';
import { FakeStreamingChatModel } from '@langchain/core/utils/testing';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { orchestrationPromptCachingMiddleware } from '@sap-ai-sdk/langchain/orchestration/prompt-caching-middleware';
import { createAgent, type ReactAgent } from 'langchain';
import { assertAdvertisedToolsRegistered } from './agent-utils.ts';
import { clearSession as clearDatabaseSession } from './session-store.ts';
import { SYSTEM_PROMPT } from './system-prompt.ts';
import { getGroundTruthTool } from './tools/get-ground-truth-tool.ts';
import {
  queryFinancialPlanningTool,
  queryJournalEntryTool,
} from './tools/odata-tools.ts';
import { runRptPredictionTool } from './tools/rpt-tool.ts';
import { runSqlTool } from './tools/sql-tool.ts';
import { runTabpfnPredictionTool } from './tools/tabpfn-tool.ts';

export const AGENT_RECURSION_LIMIT = 64;

function buildFinancialAgent() {
  // YOUR CODE START
  /*
  const orchestrationClient = new OrchestrationClient([
    {
      promptTemplating: {
        model: {
          name: 'anthropic--claude-4.6-sonnet',
          params: { reasoning_effort: 'low' },
        },
      },
    },
  ]);
  */

  const tools: never[] = [];

  const systemPrompt = systemPromptForTools(tools);

  const middleware = [orchestrationPromptCachingMiddleware()];

  // Exercise 1, Step 3: replace ALL FOUR placeholders below with the variables above.
  // Declaring them does not configure the agent; createAgent must receive them.
  return createAgent({
    model: {} as never,
    systemPrompt: 'TODO',
    checkpointer,
    tools: [],
    middleware: [],
  });
  // YOUR CODE END
}

// DO NOT EDIT BELOW THIS LINE

function systemPromptForTools(tools: readonly { name: string }[]): string {
  if (tools.length === 0) {
    return `You are a financial data analyst assistant in an SAP AI Core workshop.

The completed agent can load SAP financial planning and journal-entry data through OData, analyse it with SQL in a local workspace, forecast with SAP RPT or TabPFN, and compare predictions against actuals.

None of those capabilities are available in this run: no tools are registered. You cannot access SAP services, load or query data, execute SQL or code, run prediction models, or retrieve actuals for evaluation. Do not imply that you have accessed data or performed any of these actions, and never invent results.

Answer general questions and reason only from information the user provides. If a request needs an unavailable capability, state the limitation briefly and explain which capability would be needed. You may suggest SQL or an analysis approach, but make clear it has not been executed. Keep answers concise.`;
  }

  const availableTools = tools.map((tool) => tool.name).join(', ');
  const hasGroundTruth = tools.some((tool) => tool.name === 'get_ground_truth');
  const evaluationBoundary = hasGroundTruth
    ? 'Use get_ground_truth only when the user explicitly requests validation, accuracy, or comparison against actuals, and only after a prediction tool has produced an output table.'
    : 'Ground-truth evaluation is unavailable. Do not fetch target-period actuals solely to validate an ex-ante forecast, and do not claim validation, accuracy, actual comparisons, or ground-truth metrics.';

  return `${SYSTEM_PROMPT}

Tool boundary:
- Available tools in this run: ${availableTools}.
- Use only the available tools listed above.
- Never claim that an unavailable tool was called.
- If the request requires an unavailable capability, say so explicitly.
- Never fabricate tool results, tables, predictions, or evaluation metrics.
- ${evaluationBoundary}`;
}

const checkpointer = new MemorySaver();
/** Clears all process-local state owned by a web session. */
export async function clearFinancialSession(sessionId: string): Promise<void> {
  const results = await Promise.allSettled([
    clearDatabaseSession(sessionId),
    checkpointer.deleteThread(sessionId),
  ]);
  const errors = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  );
  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to clear session ${sessionId}`);
  }
}

// Wraps buildFinancialAgent so that exercise starter states (where the model is not
// yet configured) produce a stub response instead of crashing the server.
function buildAgentWithStubFallback(): ReactAgent {
  const agent = buildFinancialAgent();
  assertAdvertisedToolsRegistered(agent.options);
  if (!(agent.options.model instanceof OrchestrationClient)) {
    return createAgent({
      model: new FakeStreamingChatModel({
        responses: [new AIMessage('This could be a chat client response.')],
      }),
      systemPrompt: '',
      checkpointer,
      tools: [],
      middleware: [],
    }).withConfig({ recursionLimit: AGENT_RECURSION_LIMIT }) as ReactAgent;
  }
  return agent.withConfig({
    recursionLimit: AGENT_RECURSION_LIMIT,
  }) as ReactAgent;
}

const agentInstance = buildAgentWithStubFallback();

export function getFinancialAgent() {
  return agentInstance;
}

/** Returns the shared agent instance (MemorySaver checkpointer, one per process). */
export function createFinancialAgent() {
  return getFinancialAgent();
}

export { visibleReasoning } from './agent-utils.ts';
export {
  clearSession,
  createSession,
  sessionContext,
  touchSession,
} from './session-store.ts';
