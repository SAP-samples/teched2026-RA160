# Exercise 1 - Connecting to AI Core: Building a Chat Client

In this exercise, you will implement the core connection that lets your Spring Boot application talk to an LLM via SAP AI Core.
You'll use the [SAP Cloud SDK for AI (Java)](https://github.com/SAP/ai-sdk-java) and its [Spring AI](https://spring.io/projects/spring-ai) integration.

## Overview

In this task we will wire up a so-called _chat client_ so the application can send a prompt to an LLM and receive a response.
In order to do this, we will perform the following steps:
- Connect your application to SAP AI Core via the orchestration service.
- Choose which LLM to use.
- Assemble a conversation — a system instruction and the user's question — and send it to the LLM.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `callChatClient` method in `AgentService.java`.
Also, feel free to ask the presenters in your session for help at any time.


## Background: What is the Orchestration Service?

The [orchestration service](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) sits in front of multiple LLM providers (OpenAI, Anthropic, etc.) available through SAP AI Core's Generative AI Hub.
Instead of talking to a vendor API directly, your code uses a single harmonized API — which handles content filtering, data masking, templating, grounding, and more.

In Spring AI terms, this means we use `OrchestrationChatModel` (instead of, say, `OpenAiChatModel`) and we configure our model choice through `OrchestrationModuleConfig` (instead of an API key and model string).

## Step 1: Explore the code

Before writing any code, take a few minutes to read the files involved in this exercise.

The relevant source tree under `java-app/` is:

```text
java-app/
├── agent/
│   └── src/main/java/com/sap/teched/demo/
│       ├── agent/
│       │   ├── AgentService.java     ← you will implement the agent here
│       |   ├── AgentConfig.java      ← Declares the ChatMemory
│       │   └── AgentTrace.java       ← streams tool-call events to the frontend
│       ├── web/
│       │   └── AgentController.java  ← REST endpoints; no changes needed
│       ├── tool/                     ← the tools our agent will use (see Ex.2)
│       ├── odata/
│       │   └── S4ODataService.java   ← OData client wrapping the SAP Cloud SDK
│       └── db/
│           └── DuckDbConnection.java  ← in-memory DuckDB workspace
├── webui/                             ← React frontend shared with the JS app (no changes needed)
└── exercises/                         ← exercise guides
```

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and look through it.
A few things to notice:

- **`SYSTEM_PROMPT_BASE`** — the long string constant at the top of the class. This is the standing instruction that shapes the agent's behaviour for every request: how to use tools, how to present results. You do not need to change it; just know it is there.
- **`systemPromptForTools(options)`** — a helper method that takes the final `OrchestrationChatOptions` (the one that already has tools registered on it) and builds the complete system prompt by appending a "Tool boundary" section to `SYSTEM_PROMPT_BASE`. That section lists exactly which tools are available in the current run.
- **Field declarations** — below `SYSTEM_PROMPT_BASE` you will see the tool beans injected by Spring (`financialPlanningTool`, `journalEntryTool`, etc.). These are the data and forecasting tools the agent will gain access to in later exercises. For now, you can ignore them.
- **`run()`** — the public entry point called by `AgentController` when a prompt arrives from the browser. It sets up an `AgentTrace` for streaming information to the frontend and delegates to `callChatClient`. You do not need to change this method.
- **`callChatClient()`** — this is where your work starts. It currently contains a commented-out solution block (`/* ... */`). Your task is to implement it step by step using the instructions below.
- There are additional methods below that. We will tackle them in future exercises.

The UI of our demo application looks like this.
![The financial agent chat UI — empty state before any prompts](img/ex1-ui-empty.png)
There is an input panel on the bottom and in the middle of the screen you can find some demo sentences (which will only work once you have completed the first 3 exercises).
On the left hand side you will see an overview of the tools that are run once we enable them in Exercise 2.
Notice that if you run the application right now, you will be able to interact with the UI already.
But since we did not implement the agentic behaviour yet, you will only get a pre-defined output of `This could be a chat client response.`
We will change that in this exercise.


## Step 2: Create an `OrchestrationModuleConfig`

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and find the `callChatClient` method.
The solution code is commented out inside the `/* ... */` block — your task in the steps below is to put it back in, one piece at a time.

The `OrchestrationModuleConfig` holds the configuration for your Orchestration call: mainly which LLM to route to, but also additional optional settings like content filters, data masking rules, and more.
Create one and set _Claude 4.6 Sonnet_ as the model.

```java
final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
```

`CLAUDE_4_6_SONNET` is a constant from `OrchestrationAiModel` and is already statically imported at the top of the file.
You can swap this constant for any other model supported by Orchestration (e.g., `GPT_4O`) once you have the basic flow working.


## Step 3: Create an `OrchestrationChatModel`

Next, create the `ChatModel` that Spring AI will use to talk to Orchestration:

```java
final ChatModel chatModel = new OrchestrationChatModel();
```

`OrchestrationChatModel` is a Spring AI `ChatModel` implementation provided by the SAP Cloud SDK for AI.
This is where the connection to SAP AI Core is established in the background.
`OrchestrationChatModel` reads SAP AI Core connection details (service key, resource group, deployment) automatically from the environment, so no credentials appear in your code.


## Step 4: Wrap the configuration in `OrchestrationChatOptions`

`OrchestrationChatOptions` is the Spring AI `ChatOptions` implementation that carries our `OrchestrationModuleConfig` into the request.
Create it from the config object you built in Step 1:

```java
final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
```

Think of this as the default configuration: the same `ChatModel` can be reused for different models or settings by passing different `options` objects each time.

The usage of `OrchestrationChatModel` here enables the application to use all the different LLM models provided through AI Core.
We will have more on how to change the models later in this exercise.
It also enables the addition of AI Core resilience features, which you will see in Exercise 4.


Note that in a productive application, we would most likely build this only once at start-up of the app.
For demo purposes, we build a new `chatModel` and `options` object on every user input here.


## Step 5: Build the `ChatClient`

The `ChatClient` is Spring AIs object to handle a single conversation.
It is build from our `ChatModel` object and additionally holds the system prompt and further specifications like the chat memory advisor we will see in Step TODO.

```java
final ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultSystem(systemPromptForTools(options))
    .build();
```


## Step 6: Write the `Prompt`

A `Prompt` is the complete input sent to the LLM for each user turn of the conversation.
It consists of the current user message and, optionally, call-level options.
We will provide it with the `userInput` string we are given as input to the `callChatClient` method and the `OrchestrationChatOptions` we created in Step 4.

```java
final Prompt prompt = new Prompt(userInput, options);
```


## Step 7: Call the LLM and return its response

We are now ready to send the actual call to the LLM and return the response.

```java
final String answer = chatClient
    .prompt(prompt)
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, sessionId))
    .call()
    .content(); 
return answer;
```

This sends the request to Orchestration synchronously and waits for the response.


## Step 8: Give the agent memory across turns

Right now your `callChatClient` method is simply sending the system prompt plus a single message to the LLM.
That means the agent has no idea what was said in any previous turn of the same conversation which makes follow-up questions impossible.

To fix this you need to:

1. On each call, retrieve the history for the current session, append the new user message, and pass the full list to the LLM.
2. After the LLM responds, append the assistant's reply to the history so future calls can see it.

Fortunately, you do not have to implement this logic yourself, but can use Spring AIs `ChatMemory`.

Above the line you defined the `ChatClient`, create a `MessageChatMemoryAdvisor`.
It automatically prepends the conversation history for the given conversationId to each outgoing prompt, and saves the new user input back to the `ChatMemory` store afterwards.
This advisor then needs to be added to the `ChatClient` object.

```java
final MessageChatMemoryAdvisor memoryAdvisor = MessageChatMemoryAdvisor.builder(chatMemory).build();

final ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultSystem(systemPromptForTools(options))
    .defaultAdvisors(memoryAdvisor)
    .build();
```

Additionally, we need to make the advisor aware of the current session when calling the LLM through the `ChatClient`.
We do that by providing it with the session id.
In order to do that, change the LLM call at the end of your `callChatClient` method to look like the following.

```java
final String answer = chatClient
    .prompt(prompt)
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, sessionId))
    .call()
    .content();
```

Giving it the session id not only makes the memory work for multi-turn conversations with follow-up questions, it also means that the conversation is confined to the current session.
That means, if you open the same application from two different browser tabs, the conversation will not interfere with each other.
They will be two completely seperate conversation managed through the same single running application.

## Step 9: Recap

We are now ready to recap and try out our application.

In total, your `callChatClient` method should look like this:

```java
private String callChatClient(final String userInput, final String sessionId) {

    final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
    final ChatModel chatModel = new OrchestrationChatModel();
    final OrchestrationChatOptions options = new OrchestrationChatOptions(config);

    final MessageChatMemoryAdvisor memoryAdvisor = MessageChatMemoryAdvisor.builder(chatMemory).build();

    final ChatClient chatClient = ChatClient.builder(chatModel)
        .defaultSystem(systemPromptForTools(options))
        .defaultAdvisors(memoryAdvisor)
        .build();

    final Prompt prompt = new Prompt(userInput, options);

    final String answer = chatClient
        .prompt(prompt)
        .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, sessionId))
        .call()
        .content();
    return answer;
}
```

## Step 10: Start the application and test it

**Please make sure that all your changes are saved.**
Visual Studio Code is configured to not save automatically, so you need to save every file you change by hand (easiest is to press `CTRL + s` while in the file).

Start the application with the following command.
(If it was already running, stop the previous run by pressing `CTRL + c` first and pressing `y` to agree to end the subprocesses.)

```bash
pnpm run java-agent
```

Navigate to **http://localhost:3142/** in your browser to see the frontend of our application. You should see an input field for text. Try a multi-turn conversation like the following:

> "Who are you and what can you do?"

Then, without reloading the page, follow up with:

> "Summarise what you just told me in one sentence."

The agent should answer the second question using context from the first — proof that the history is working.


## Step 11: Understanding what just happened

When you submitted the query, the following happened:

1. The browser posted the prompt text to `AgentController`, which called `AgentService.run()`.
2. `run()` called `callChatClient(prompt, sessionId)`.
3. `callChatClient` looked up (or created) the history list for this session, appended the user message, and sent the full history to Claude 4.6 Sonnet via the orchestration service.
4. The LLM's response was appended to the history and streamed back to the browser.
5. On the next message, the history already contains the prior user + assistant turns, so the model has full context.

The entire setup — credentials, resource groups, deployment IDs — was read automatically from the environment by `OrchestrationChatModel` thanks to the SAP Cloud SDK for AI.
This is the same pattern you would use in a production BTP application: no secrets in code, just configuration in the environment.


## Step 12: Try different models

The only thing you need to change to switch models is the constant passed to the `OrchestrationModuleConfig` constructor.
Try replacing `CLAUDE_4_6_SONNET` with another constant, for example `GEMINI_3_8_FLASH`, restart, and ask the same question again.
Notice how the phrasing, response times, and verbosity of the answer changes — the system prompt is identical, only the model is different.

Available constants are defined in the `OrchestrationAiModel` class of the Cloud SDK for AI.

To restart the application after your code changes, press `CTRL + c` while in your terminal and press `y` to agree to end the subprocesses.
Then run `pnpm run java-agent` again.
Your application should be back up on the same address in your browser within seconds.


## Summary

You have successfully connected a Spring Boot application to an LLM via SAP AI Core using the SAP Cloud SDK for AI.
Your agent can now receive a user prompt, maintain a per-session conversation history, and return the LLM's answer — meaning follow-up questions are answered with full context of the prior turns.

You can find more information on how to use the [SAP Cloud SDK for AI](https://sap.github.io/ai-sdk/docs/java/getting-started) and [SAP AI Core](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) in the linked docs.

In Exercise 2 we will give the agent access to its tools — OData services, a local SQL database, and an AI forecasting model — so it can actually query, aggregate, and forecast financial data.

Continue to [Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop](../ex2/README.md).
