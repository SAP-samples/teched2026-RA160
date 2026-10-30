# Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully

In this exercise, you will use the [orchestration service's](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) **fallback config** feature to make your agent resilient to model-level failures.
You will first deliberately break the configuration to see what an unhandled failure looks like, and then add a fallback so the agent recovers automatically.

This exercise is self-contained — it does not depend on the tools from Exercises 2 and 3 and can be done at any point after Exercise 1.

## What you'll learn

By the end of this exercise, you'll understand how passing an array of model configurations to the `OrchestrationClient` class enables automatic failover — no retry logic, no error-handling code in your application.
You'll see the failure mode first-hand before adding the fallback, so you understand exactly what the feature protects against.

If you have any trouble, each step below shows the complete config to paste into the `agent.ts` file.

## Background: What are fallback configs?

Each entry in the array you pass to the `OrchestrationClient` class describes one Orchestration call configuration: which LLM to use, and optionally which content filters, data masking rules, and other settings to apply.
Normally you create one entry and let the agent use it for every request.

But what happens when the model you chose is temporarily unavailable, has hit its quota limit, or simply does not exist in the cluster your customer is using?
Without any fallback, the call fails and the agent returns an error to the user.

The orchestration service supports **multiple configs in priority order**.
If a call with the first config fails, the service immediately retries with the second config — transparently, without any retry logic in your code.
If that also fails, the service tries the next config in the list until one succeeds.

This is useful for several real-world scenarios:

- **Primary model quota exhausted:** fall back to a smaller, cheaper model.
- **Model deprecation:** route traffic to a newer model while old integrations are still in use.
- **Regional availability:** the primary model is unavailable in one region, while the fallback is available globally.

## Step 1: Trigger a failure — send a request with a broken config

Open the `agent.ts` file and find the `buildFinancialAgent()` function.
Replace the first model config with one that references a model name that does not exist:

```typescript
const orchestrationClient = new OrchestrationClient({
  promptTemplating: {
    model: {
      name: 'broken-model-name',
    },
  },
});
```

If the application is not already running, start it:

```bash
pnpm run js-agent
```

Ask any question in the UI.
The failure may take up to about a minute because the request must travel through the orchestration service before the unavailable model is rejected.
You should eventually see an error response — the orchestration service cannot resolve `"broken-model-name"` to a deployment and returns an error, which the agent surfaces to the browser.
Check the terminal for the underlying error details.

## Step 2: Add a working config as a fallback

Now restore a working config as the second entry in the array:

```typescript
const orchestrationClient = new OrchestrationClient([
  {
    promptTemplating: {
      model: {
        name: 'broken-model-name',
      },
    },
  },
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

The array is tried left-to-right.
If the first config fails (as it will here, because `"broken-model-name"` does not exist), the orchestration service automatically retries with the second config.
Your application code does not change — the failover is handled entirely server-side by AI Core Orchestration.

## Step 3: Test it

Save the config and ask the same question again.
The development server reloads automatically.
This time the call should succeed and return a response from `anthropic--claude-4.6-sonnet` — even though the primary config was deliberately broken.

You will not see any change in the response format.
Fallback is transparent to the caller: the agent and the user receive a normal response regardless of which config in the array ultimately handled the request.

![Fallback is transparent — the user sees a normal response](img/ex4-fallback.png)

> **Tip:** You can chain as many fallbacks as you like by adding more entries to the array.
> The service tries them left-to-right and stops at the first success.

## Step 4: Understanding what happens under the hood

When the `OrchestrationClient` instance sends a request, all configs in the array are included in the request payload.
The orchestration service handles the retry logic server-side.
This means:

- No extra round trips through your application for each retry.
- No need for a Resilience4j circuit breaker (Java) or a retry library (JavaScript) in your code.
- The same fallback logic applies to both streaming and non-streaming calls.

The first config is always tried first.
Fallback configs are only attempted if the primary attempt returns an error from the LLM layer (for example, model not found or quota exceeded).
Other error types — network failures, malformed requests — are not retried by the fallback mechanism.

Now that you have verified the fallback, restore the `agent.ts` file to a clean state with two working configs:

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
  {
    promptTemplating: {
      model: {
        name: 'gemini-3.8-flash',
      },
    },
  },
]);
```

This is the configuration the agent was designed to run with throughout the workshop.
The first config sets `reasoning_effort: 'high'` so the Claude model applies deeper reasoning on complex analytical requests; `gemini-3.8-flash` is its fallback.

## Summary

You have made the financial analyst agent resilient to model-level failures using the orchestration service's fallback feature.
Key takeaways:

- Passing multiple entries to the `OrchestrationClient([...])` constructor call registers fallback configurations in priority order.
- Failover is handled server-side by the orchestration service — no retry logic needed in your TypeScript code.
- The feature works identically for streaming and non-streaming calls.
- The first config is tried first; fallbacks are only reached on LLM-layer errors.
- The calling code and the end user are not aware that a fallback occurred.
