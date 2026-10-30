[![REUSE status](https://api.reuse.software/badge/github.com/SAP-samples/teched2026-RA160)](https://api.reuse.software/info/github.com/SAP-samples/teched2026-RA160)

# RA160 - Build business differentiation with SAP AI Core

## Description

This repository contains the material for the SAP TechEd 2026 session **RA160 – Build business differentiation with SAP AI Core**.

Experience SAP AI Core as the orchestration layer for enterprise AI. Our engineers help you extend Joule Agents with models from [SAP Cloud SDK for AI](https://sap.github.io/ai-sdk/), ground them in products for SAP Business Data Cloud, and embed them in the flows of SAP S/4HANA. Learn to govern, scale, and monitor AI agents from prototype to production.

In this workshop, you will build a financial data agent that queries a mock S/4HANA OData backend, stores the results in a local scratch database, and uses RPT / TabPFN on SAP AI Core to forecast future periods — all wired together through the [orchestration service](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration). 
Implementations are provided in both **TypeScript** (LangChain + SAP Cloud SDK for AI) and **Java** (Spring AI + SAP Cloud SDK for AI).

> [!WARNING]
> This repository is a workshop demo, not production-grade software. Do not use it in production without appropriate security, reliability, and operational review.


## Overview

The agent follows a deliberate reasoning pattern:

1. **Load** — OData tools call the mock S/4HANA services and stage the rows in a per-session in-memory workspace.
2. **Analyse** — An SQL tool runs deterministic filtering, joins, and aggregations over the staged data.
3. **Predict** — Forecasting tools submit the workspace tables to RPT / TabPFN on SAP AI Core and retrieve predictions.
4. **Evaluate** — A ground-truth tool re-fetches actuals from the mock backend and compares them against the forecast.

## Requirements

- [Git](https://git-scm.com/downloads) and an editor such as [Visual Studio Code](https://code.visualstudio.com/)
- Node.js 24 or 26 and pnpm 12 or 11 (**both** Java and JavaScript exercises use these for the web UI and mock server)
- Java **JDK 21** (Java exercises only)
- Access to SAP AI Core / Generative AI Hub; workshop credentials are provided by the instructor

Already have these tools? Continue with the version checks below.

### Windows (PowerShell)

Open **Terminal / PowerShell** from the Start menu and install Git, Node.js, and pnpm:

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id pnpm.pnpm --exact
```

For the **Java exercises**, also install SapMachine JDK 21:

```powershell
winget install --id SAP.SapMachine.21.JDK --exact
```

Close and reopen your terminal so the installed commands are available. For Java, check that `javac -version` reports **21**, then set `JAVA_HOME` in the terminal you will use for the workshop:

```powershell
javac -version
$javacPath = (Get-Command javac.exe).Source
$env:JAVA_HOME = Split-Path (Split-Path $javacPath -Parent) -Parent
```

If `javac` reports another version, set `$env:JAVA_HOME` to your SapMachine JDK 21 installation folder instead.

### macOS (Terminal)

If you use [Homebrew](https://brew.sh/), install Git, Node.js, and pnpm:

```sh
brew install git node pnpm
```

Without Homebrew, use the [Git installation options](https://git-scm.com/downloads/mac) and the [Node.js LTS installer](https://nodejs.org/en/download), then run `npm install --global pnpm@12`.

For the **Java exercises**, install SapMachine JDK 21 using Homebrew:

```sh
brew install --cask sap/sapmachine/sapmachine21-jdk
```

Alternatively, use the [SapMachine JDK 21 installer for your Mac](https://sapmachine.io/docs/installation). Then select Java 21 in your workshop terminal:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -F -v 21)
```

The Windows and macOS `JAVA_HOME` commands above apply to the **current terminal only**. Repeat them if you open a new terminal for the Java exercises.

### Check your tools

In your terminal, run:

```sh
git --version
node --version
pnpm --version
```

Expect Node.js **24.x or 26.x** and pnpm **12.x** (an existing pnpm **11.x** installation also works).

> [!NOTE]
> If you are using Java and encounter build failures later in the demo, check the JDK Maven uses. After cloning the repository, from `java-app/agent`, run `./mvnw.cmd --version` on Windows or `./mvnw --version` on macOS/Linux. The output should report Java **21**.

## Getting Started

### Clone the Repository

Open a terminal in the folder where you want to keep the workshop files, then run these commands (PowerShell, macOS Terminal, or a Linux shell):

```sh
git clone https://github.com/SAP-samples/teched2026-RA160.git
cd teched2026-RA160
```

Open the `teched2026-RA160` folder in Visual Studio Code via **File → Open Folder…**. Use **Terminal → New Terminal** to open a terminal in the repository root; the exercise setup commands run from this folder.

![How to open a folder in VS Code](img/vsc.png)

If you selected the Java track, set `JAVA_HOME` in this VS Code terminal before starting the exercises:

Windows (PowerShell):

```powershell
$javacPath = (Get-Command javac.exe).Source
$env:JAVA_HOME = Split-Path (Split-Path $javacPath -Parent) -Parent
```

macOS:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -F -v 21)
```

> Note: If at any point during the demo a pop-up like the following appears, simply click on `Allow`.
![Pop-up example](img/pop-up.png)

### Choose Your Workshop Track

**Setup complete? Choose one track** and continue with its exercise guide. Both tracks build the same financial data agent.

| JavaScript / TypeScript | Java |
|---|---|
| LangChain + SAP Cloud SDK for AI | Spring AI + SAP Cloud SDK for AI |
| **[Start the JavaScript exercises →](js-app/exercises/README.md)** | **[Start the Java exercises →](java-app/exercises/README.md)** |

### Prepare Workshop Credentials (Organizers)

Place the dedicated, short-lived workshop service key in the ignored root `.env` file, then run:

```sh
pnpm workshop:encrypt
```

Generate a strong random passphrase. The command validates `AICORE_SERVICE_KEY` and prompts twice for that passphrase; it only rejects empty or mismatched input because character count does not prove entropy. It creates `workshop/service-key.age`, the encrypted payload to commit to the repository. The passphrase is never persisted by the script; distribute it out of band.

The command refuses to overwrite the payload. Use `pnpm workshop:encrypt --force` only when rotating the workshop credential, and revoke the service key immediately after the workshop.

## Contributing
Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) to understand the contribution guidelines.

## Code of Conduct
Please read the [SAP Open Source Code of Conduct](https://github.com/SAP-samples/.github/blob/main/CODE_OF_CONDUCT.md).

## How to obtain support
Support for the content in this repository is available during the actual time of the online session for which this content has been designed. Otherwise, you may request support via the [Issues](https://github.com/SAP-samples/teched2026-RA160/issues) tab.

## License
Copyright 2026 SAP SE or an SAP affiliate company and teched2026-RA160 contributors. Please see our [LICENSE](LICENSES/Apache-2.0.txt) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP-samples/teched2026-RA160).
