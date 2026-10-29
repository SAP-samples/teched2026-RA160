# Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop

In this exercise, you will add tools to the agent so it can fetch financial workshop data, run SQL aggregations, and reason across multiple data sources.
You'll learn how LangChain's `createAgent()` function, running on LangGraph's runtime, drives the back-and-forth between the LLM and your locally executed tools.

Complete [Exercise 1](../ex1/README.md) before starting this exercise.

## What you'll learn

By the end of this exercise, your agent will be able to fetch financial planning and journal entry data from SAP OData services, load it into an in-memory SQL workspace, and answer questions that require SQL aggregation — all driven autonomously by the LLM through tool calls.
You'll understand how LangGraph routes tool-call messages to your functions and why the agentic loop requires no manual orchestration code in your application.

### Where does the financial data come from?

The workshop uses a **local OData server embedded in the application**, backed by the sample dataset in [`mock-server/data/seed.sql`](../../../mock-server/data/seed.sql). It provides financial planning and journal entry endpoints modeled after SAP S/4HANA APIs; it is **not a connection to a real SAP S/4HANA system or SAP HANA database**.

The client side uses the usual **SAP Cloud SDK generated OData clients**. These clients send actual HTTP requests to the local server, which processes OData filters and returns data that the tools load into the session's in-memory DuckDB workspace. The dataset and backend are simulated, but the OData requests and data retrieval are real — not hard-coded tool responses.

You can inspect the financial planning service at [http://localhost:3142/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/](http://localhost:3142/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/) while the application is running.

## Background: How tool calling works

Large language models cannot directly run code or query databases.
Instead, they communicate _intent_: when the model decides it needs data, it returns a structured tool-call message naming the tool and the arguments it wants to pass.
Your application executes the tool, sends the result back, and the model continues reasoning — possibly calling more tools — until it produces a final answer.

This back-and-forth is called the **agentic loop**.
Schematically:

```text
CLIENT SIDE                         SERVER SIDE

  User prompt ──────────────────────► LLM
                                       │
  Tool execution ◄─── tool call ───────┤
        │                              │
        └──────── tool result ───────► LLM
                                       │
             (repeat as needed)        │
                                       │
  Final result UI ◄── streamed answer ─┘
```

LangGraph drives this loop automatically.
When you pass the `tools` array to the `createAgent()` function, LangGraph intercepts tool-call responses, invokes the matching function, injects the result back into the conversation, and calls the LLM again — looping until the model produces a plain-text answer.
No manual loop is needed in your code.

Your tools execute locally in your application process — the orchestration service wraps only the LLM calls, not tool execution.
Orchestration can apply content filtering to the LLM's input and output when you configure a `filtering` module, but this exercise does not configure one.

## Step 1: Get to know the tools

Open the following files and read the `tool(...)` definitions at the bottom of each:

| File                                                     | Tool name                  | What it does                                                                                                                                  |
| -------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`odata-tools.ts:104`](../../agent/src/tools/odata-tools.ts#L104) | `query_financial_planning` | Fetches financial planning entries from the OData API and **appends** them into a named session table. |
| [`odata-tools.ts:174`](../../agent/src/tools/odata-tools.ts#L174) | `query_journal_entry` | Fetches journal entry items from the OData API and **appends** them into a named session table. |
| [`sql-tool.ts:7`](../../agent/src/tools/sql-tool.ts#L7) | `run_sql` | Executes SQL against the session's in-memory workspace — `SELECT` for reporting, `CREATE OR REPLACE VIEW` to define virtual tables, and more. |

You will register these three data tools in this exercise.
Exercise 3 adds RPT, TabPFN, and ground-truth tools after the SQL workflow is established.

### Understanding planning categories in SAP financial data

When the `query_financial_planning` tool queries financial planning data, entries are partitioned by the **`planningCategory`** property.
In SAP financial planning, four distinct categories represent different perspectives on the same financial dimensions:

- **`ACTUAL`**: Realized, historical financial amounts recorded from executed business transactions (what was *actually* spent or earned).
- **`PLAN`**: Operational planning figures established by business units as targets for future periods.
- **`BUDGET`**: Approved financial limits / spending allocations authorized by management.
- **`FORECAST`**: Rolling estimates updated periodically throughout the fiscal year reflecting recent trends.

> **Why this distinction matters:** All four categories live in the same OData entity.
> If an agent aggregates amounts without filtering by `planningCategory`, it will sum actuals, budgets, plans, and forecasts together — quadrupling or distorting the totals!
> In **Exercise 3**, you will use historical `ACTUAL` values as training context, combined with `PLAN`, `BUDGET`, and `FORECAST` as predictive features, to **predict future ACTUAL values**.

Each tool is defined with the `tool(fn, { name, description, schema })` helper from `@langchain/core/tools`.
The helper packages your function with the name, description, and input schema that LangChain sends to the LLM as its tool definition.
The `description` string and the Zod `schema` together form the function definition the model sees, so it knows _when_ and _how_ to call each tool.

> **Tip:** Open the `odata-tools.ts` file and read the `description` and `schema` fields of `queryFinancialPlanningTool`.
> Notice how parameter names and descriptions mirror the OData filter fields the model will pass in its tool-call JSON.
> Clear tool descriptions are as important as the implementation — they are the model's only guide.

## Step 2: Register the tools on the agent

Go back to the `buildFinancialAgent()` function in `agent.ts`.
Replace the empty `tools` array with the three data tools:

```typescript
const tools = [
  queryFinancialPlanningTool,
  queryJournalEntryTool,
  runSqlTool,
];
```

The array only registers tools if the `createAgent()` call receives **`tools,`**, as wired in
Exercise 1. `systemPromptForTools(tools)` describes the tools; it does not register them.
If the call still contains `tools: []` or omits any advertised tools, the startup wrapper
stops with an `Agent configuration error` naming the missing tools. Pass the same `tools`
array to both functions.

LangChain registers each tool's name, description, and schema with the model automatically.
When the model issues a tool-call message naming one of these tools, LangGraph routes it to the corresponding function in your application.

## Step 3: Verify the full `buildFinancialAgent()` function

After Step 2, the relevant parts of the `buildFinancialAgent()` function should look like this:

```typescript
function buildFinancialAgent() {
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

  const tools = [
    queryFinancialPlanningTool,
    queryJournalEntryTool,
    runSqlTool,
  ];

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

Navigate to the UI and ask a question that requires real data:

> "What was the total planned spend for cost center A1000 in fiscal year 2024?"

Watch the **Activity** panel on the left — you should see tool calls appear as the agent:

1. Calls the `query_financial_planning` tool to fetch planning rows for that cost center and year.
2. Calls the `run_sql` tool to aggregate the loaded rows with SQL (`SUM`, `GROUP BY`, etc.).
3. Returns a formatted answer with the aggregated numbers.

![The Activity panel showing query_financial_planning and run_sql tool calls](img/ex2-activity.png)

## Step 5: Understanding the agentic loop in practice

What you observed in Step 4 is the full agentic loop.
The LLM never had direct access to the database — it issued _instructions_ (tool-call messages) and your application executed them.

Here are a few things worth noticing:

- **SQL as a universal adapter:** Instead of many specialized read operations, the agent has one general-purpose SQL tool (`run_sql`).
  This gives the model enormous flexibility: it can filter, join multiple tables, compute running totals, or pivot data — skills it already knows well from its training data.

- **Append semantics:** The `query_financial_planning` and `query_journal_entry` tools always _append_ rows to their tables.
  If the model calls either tool twice with the same filters, rows are duplicated.
  The system prompt warns the model that overlapping loads may need deduplication by `id` before aggregating.

## Step 6: Try more complex queries

Try the following prompts to explore the agent's tool-calling behavior:

- **Multi-step aggregation:**

  > "Compare actual journal entry spend vs. planning ACTUAL for cost center A1000 in 2023."

  The agent needs to load both OData tables and join them in the in-memory workspace.

- **Cross-year comparison:**

  > "How did total planned spend for cost center A1000 change between 2022 and 2024?"

  The agent should load multiple years of planning data and aggregate with `GROUP BY ledgerFiscalYear`.

In each case, watch the **Activity** panel to see which tools are called and with what arguments.
This transparency is one of the key advantages of the agentic architecture over a black-box query engine.

![The Activity panel showing both OData tools and SQL fired for the multi-source query](img/ex2-multi-source.png)

## Summary

You have equipped the financial analyst agent with its data and SQL tools.
Your agent can now:

- Fetch financial planning and journal entry data from SAP OData services into an in-memory SQL workspace.
- Query, filter, join, and aggregate that data with SQL.

All of this is driven autonomously by the LLM through the agentic tool-calling loop — the only code you wrote was registering the tools in the `tools` array.

In Exercise 3 you will add the SAP RPT, TabPFN, and ground-truth tools to this SQL-first agent to predict future values and evaluate accuracy.

Continue to [Exercise 3 - Forecasting with SAP RPT and TabPFN: Predicting Future Financial Data](../ex3/README.md).
