# Preparation

Follow the steps below to install the demo application and start with the exercises.

## Installation

Install dependencies (needed for the JS frontend and S/4HANA mock) from the repository root.

```sh
pnpm install
```

### Configure SAP AI Core credentials

During the workshop, configure the shared SAP AI Core credentials from the repository root:

```sh
pnpm workshop:setup
```

Enter the passphrase provided by the instructor, on success the command writes the decrypted service key to the root `.env` file.

If you use your own SAP AI Core instance, store its service key as one line in the root `.env` file:

```sh
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
```

### Start the Java Demo

```sh
pnpm run java-agent
```

Spring Boot binds to port `3143` and starts the mock S/4HANA server and web UI as child processes. Wait for `webui is ready on port 3142`, then open `http://localhost:3142`. 
Ctrl-C stops all three processes.

Right now, the app has a working front end but a lot of the functionality is missing.
This is what we will work on during this session.

## Exercises

Follow the exercises in order. Each exercise builds on the previous one.

| Exercise                                                        | Topic |
|-----------------------------------------------------------------| --- |
| [Exercise 1](ex1/README.md)| Connect a Spring Boot app to SAP AI Core; first LLM round-trip |
| [Exercise 2](ex2/README.md)                                     | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3](ex3/README.md)                                     | Add forecasting tools; agent predicts future periods with SAP RPT |
| [Exercise 4](ex4/README.md)                                     | Orchestration fallback configs; agent recovers from model-level failures |

### Finding the code

The Java code you need fore these exercises is located at `java-app/agent/src/main/java/com/sap/teched/demo`.
You will need to work with the two files `/agent/AgentService` (Exercises 1,2, and 4) and `tool/RptPredictionTool` (Exercise 3).

![Pop-up example](img/java-files.png)
