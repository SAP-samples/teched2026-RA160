# Preparation

Follow the steps below to install the demo application and start with the exercises.

## Installation

Install dependencies from the repository root:

```sh
pnpm install
```

### Configure SAP AI Core access

During the workshop, configure the shared SAP AI Core credentials from the repository root:

```sh
pnpm workshop:setup
```

Enter the passphrase provided by the instructor, on success the command writes the decrypted service key to the root `.env` file.


If you are using your own SAP AI Core instance and are not using the shared credentials as part of the workshop, you need the following:

- An SAP AI Core service instance with Generative AI Hub access.
- An orchestration deployment in that instance. Follow the [SAP AI Core documentation for creating an orchestration deployment](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/create-deployment-for-orchestration?locale=en-US).
- A service key for the SAP AI Core instance. The service key contains the client ID, client secret, authentication URL, and AI API URL required by the SDK.

See [What is SAP AI Core?](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/what-is-sap-ai-core?locale=en-US) for an overview of SAP AI Core instances and access.

Store your service key as one line in the root `.env` file:

```sh
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
```

### Start the web UI (JavaScript)

```sh
pnpm run js-agent
```

The UI listens on `http://localhost:3142`. The mock S/4HANA OData services (financial planning and journal entries, on the same `/sap/opu/odata/sap/` path structure as a real system) are embedded in the same process and start automatically.

## Exercises

Follow the exercises in order. Each exercise builds on the previous one.

| Exercise | Topic |
| --- | --- |
| [Exercise 1 – Connecting to AI Core: Building a Chat Agent](ex1/README.md) | Connect a TypeScript app to SAP AI Core via `OrchestrationClient`; first LLM round-trip |
| [Exercise 2 – Equipping the Agent: Tool Calls and the Agentic Loop](ex2/README.md) | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3 – Forecasting with SAP RPT and TabPFN](ex3/README.md) | Register forecasting and ground-truth tools; agent predicts future periods and evaluates actuals |
| [Exercise 4 – Resilience with Fallback Configs](ex4/README.md) | Use the orchestration service's fallback config to recover automatically from model-level failures |
