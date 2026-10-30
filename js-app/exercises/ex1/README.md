# Exercise 1 - Connecting to AI Core: Building a Chat Agent

In this exercise, you will connect a TypeScript application to an LLM via SAP AI Core.
You'll use the [SAP Cloud SDK for AI (JavaScript)](https://github.com/SAP/ai-sdk-js) and its [LangChain](https://js.langchain.com/) integration to build a working agent that can receive a user prompt and return an answer.

## What you'll learn

By the end of this exercise, your agent will be able to send a prompt to an LLM via SAP AI Core and return a response to the browser.
You'll understand how the `OrchestrationClient` class from `@sap-ai-sdk/langchain` replaces direct vendor API calls, how a model config array enables fallback (more on that in Exercise 4), and how LangChain's `createAgent()` function, running on LangGraph's runtime, drives the full request–response loop.

If you have any trouble solving the exercise, the solution code is commented out in the starter code at [agent/src/agent.ts](../../agent/src/agent.ts) — look for the `/* */` blocks.

## Background: What is the Orchestration Service?

The [orchestration service](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) sits in front of multiple LLM providers (OpenAI, Anthropic, Google, and others) available through SAP AI Core's Generative AI Hub.
Instead of talking to a vendor API directly, your code uses a single harmonized API that handles content filtering, data masking, templating, grounding, and more.

In LangChain terms, this means you use the `OrchestrationClient` class (instead of, say, the `ChatOpenAI` class) and configure your model choice through a plain config object rather than an API key and model string.

## Step 1: Familiarize yourself with the project structure

Before writing any code, take a few minutes to read the files involved in this exercise.

The project structure under `js-app/` is:

```text
js-app/
├── agent/
│   └── src/
│       ├── agent.ts          ← you will implement the agent here
│       ├── system-prompt.ts  ← system instructions for the agent
│       └── tools/
│           ├── odata-tools.ts    ← OData query tools
│           ├── sql-tool.ts       ← In-Memory SQL tool
│           ├── rpt-tool.ts       ← SAP RPT forecasting tool
│           ├── tabpfn-tool.ts    ← TabPFN prediction tool
│           └── get-ground-truth-tool.ts  ← accuracy evaluation tool
├── webui/                    ← React frontend (no changes needed)
└── exercises/                ← exercise guides
```

Open [agent/src/agent.ts](../../agent/src/agent.ts) and read it top to bottom.
Notice the following:

1. The **`buildFinancialAgent()`** function is the function you will implement.
   It contains the starter configuration for the steps in this exercise.

2. The [system-prompt.ts](../../agent/src/system-prompt.ts) file defines **`SYSTEM_PROMPT`**.
   The `systemPromptForTools(tools)` function in `agent.ts` wraps the prompt with a tool-boundary
   guardrail — it tells the model which tools are available in this run and forbids fabricating
   results from tools that are not. You do not need to change either.

3. The **`createAgent()`** function wires the model, tools, system prompt, and checkpointer together.
   Once set up, it handles the agentic loop — calling the model, executing tools, calling the model again — automatically.
   This workshop uses SQL as its only local analysis path: Exercise 2 registers OData loading tools and SQL reporting tools.

![The financial agent chat UI — empty state before any prompts](img/ex1-ui-empty.png)

## Step 2: Create an `OrchestrationClient`

Find the `buildFinancialAgent()` function in the [agent.ts](../../agent/src/agent.ts) file.
The solution code is commented out inside the `/* */` block.
Restore it one piece at a time using the instructions below.

The `OrchestrationClient` class is the LangChain-compatible model class provided by the SAP Cloud SDK for AI.
It accepts an array of model config objects, where each object describes one LLM to try in priority order.

Create the client with a single model to start:

```typescript
const orchestrationClient = new OrchestrationClient([
  {
    promptTemplating: {
      model: {
        name: 'anthropic--claude-4.6-sonnet',
        params: {
          reasoning_effort: 'low',
        },
      },
    },
  },
]);
```

The config object's `promptTemplating.model.name` field is the model identifier used by SAP AI Core's Generative AI Hub.
The SDK reads credentials, resource group, and deployment details automatically from the environment — no secrets appear in your code.

> [!IMPORTANT]
> Creating `orchestrationClient` is only the first half of the setup. The agent still uses its
> placeholder configuration until you pass the client **and the other configured values** to
> `createAgent()` in Step 3. Do not stop after uncommenting the client.

## Step 3: Wire up `createAgent()`

Find the `return createAgent({ ... })` call in `buildFinancialAgent()` — **this is where the
configuration becomes the running agent**. Variables declared above the call are not picked
up automatically. Replace all four placeholder values:

- Set `model` to `orchestrationClient`, the `OrchestrationClient` instance you created in Step 2.
  This assigns the configured model client to the agent's `model` parameter.
- Replace `systemPrompt: 'TODO'` with `systemPrompt`, the value already computed by `systemPromptForTools(tools)`.
- Replace `tools: []` with `tools`, so the tools you register in Exercise 2 reach the agent.
- Replace `middleware: []` with `middleware`, which enables orchestration prompt caching.

Leave `checkpointer` unchanged. The `const tools: never[] = []` declaration stays empty for
now — you will populate it in Exercise 2 — but the call must already use **`tools,` rather than
`tools: []`**. Otherwise later exercises can advertise tools in the system prompt without
actually registering them on the agent.

The startup wrapper checks the prompt's available-tool list against the tools passed to
`createAgent()`. If any advertised tools are missing, startup fails with an
`Agent configuration error` naming them and explaining which wiring to fix. An empty tools
array is valid in Exercise 1 because its introductory prompt advertises no available tools.

Your complete `buildFinancialAgent()` function should look like this:

```typescript
function buildFinancialAgent() {
  const orchestrationClient = new OrchestrationClient([
    {
      promptTemplating: {
        model: {
          name: 'anthropic--claude-4.6-sonnet',
          params: {
            reasoning_effort: 'low',
          },
        },
      },
    },
  ]);

  const tools: never[] = [];

  const systemPrompt = systemPromptForTools(tools);

  const middleware = [orchestrationPromptCachingMiddleware()];

  return createAgent({
    model: orchestrationClient,
    systemPrompt,
    checkpointer,
    tools,
    middleware,
  });
}
```

## Step 4: Start the application and test it

If the application is not already running, start it:

```bash
pnpm run js-agent
```

Navigate to http://localhost:3142/ and ask:

> "What financial planning data is available?"

You should see the agent respond.
At this point the agent has no tools, so it can only answer from its built-in knowledge and the system prompt.
It cannot query any real data source yet — that comes in Exercise 2.

> [!IMPORTANT]
> **Only getting "This could be a chat client response."?** This is the workshop's fixed
> placeholder response, not an answer from SAP AI Core. Uncommenting the client alone is not enough:
>
> 1. Create the `OrchestrationClient` as shown in [Step 2](#step-2-create-an-orchestrationclient).
> 2. Complete [Step 3](#step-3-wire-up-createagent): replace **all four** placeholders in
>    `createAgent()` with `orchestrationClient`, `systemPrompt`, `tools`, and `middleware`.
> 3. Save `agent.ts`, wait for the development server to reload, and ask again.

![The financial agent UI answering from the model without calling any tools](img/ex1-response.png)

## Step 5: Understanding what happened

When you submitted the query, the following happened:

1. The browser posted the prompt to the web server, which forwarded it to `getFinancialAgent()`.
2. The agent invoked the `OrchestrationClient` instance with the system prompt and user message.
3. The `OrchestrationClient` instance sent the request to the configured model via the orchestration service.
4. The model's response was streamed back to the browser.

The entire setup — credentials, resource groups, and deployment IDs — was read automatically from the environment by the `OrchestrationClient` instance.
This is the same pattern you would use in a production BTP application: no secrets in code, only configuration in the environment.

## Step 6: Try a different model

> [!TIP]
> For the best experience, please revert back to `anthropic--claude-4.6-sonnet` after trying the other model.

To switch models, replace the existing entry in the config array.
Try `gemini-3.8-flash`:

```typescript
const orchestrationClient = new OrchestrationClient([
  {
    promptTemplating: {
      model: {
        name: 'gemini-3.8-flash',
      },
    },
  },
]);
```

Save the file and ask the same question.
The development server reloads automatically.
Notice how phrasing, verbosity, and response time change — the system prompt is identical, only the model is different.

## Summary

You have connected a TypeScript application to an LLM via SAP AI Core using the SAP Cloud SDK for AI.
The agent can now receive a user prompt, apply the financial analyst system prompt, and return the model's answer.

You can find more information on how to use the [SAP Cloud SDK for AI](https://sap.github.io/ai-sdk/docs/js/getting-started) and [SAP AI Core](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) in the linked docs.

In Exercise 2 you will give the agent access to its data tools — OData services and an in-memory SQL workspace — so it can query and aggregate financial data.
Exercise 3 then adds the forecasting models.

Continue to [Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop](../ex2/README.md).
