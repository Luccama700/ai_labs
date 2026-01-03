# AI Lab - AI Model Testing & Comparison Platform

A production-ready MVP web app for testing and comparing AI models across multiple providers.

## Features

- **Multi-Provider Support**: OpenAI, Anthropic, Google Gemini, DeepSeek, and Local/OpenAI-compatible endpoints
- **API Key Management**: Secure encrypted storage with AES-256-GCM
- **Test Definitions**: Create reusable tests with prompt templates and variables
- **Batch Execution**: Run tests against multiple models with configurable batch counts
- **Validation**: Expected-contains and JSON schema validation for pass/fail determination
- **Cost Estimation**: Per-provider/model pricing with automatic cost calculation
- **Run History**: Full history with metrics, outputs, and export capabilities
- **Model Comparison**: Side-by-side output comparison across models
- **Rate Limiting**: Built-in protection against accidental spend loops
- **Dry Run Mode**: Estimate costs without calling providers

---

## Architecture Overview

### Components

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
├─────────────────────────────────────────────────────────────────┤
│  Pages (UI)           │  Server Actions       │  API Routes      │
│  - /dashboard         │  - keys.ts            │  - /api/export   │
│  - /keys              │  - tests.ts           │                  │
│  - /tests             │  - runs.ts            │                  │
│  - /runs              │  - auth.ts            │                  │
│  - /compare           │                       │                  │
├─────────────────────────────────────────────────────────────────┤
│                       Library Layer                              │
├──────────────┬──────────────┬───────────────┬──────────────────┤
│ auth.ts      │ encryption.ts│ test-runner.ts│ validation.ts    │
│ (JWT/bcrypt) │ (AES-256-GCM)│ (orchestration)│ (pass/fail)     │
├──────────────┴──────────────┴───────────────┴──────────────────┤
│                    Provider Adapter Layer                        │
├──────────────┬──────────────┬───────────────┬──────────────────┤
│ OpenAI       │ Anthropic    │ Google        │ DeepSeek         │
│ Adapter      │ Adapter      │ Adapter       │ Adapter          │
│              │              │               │                  │
│              │    Local/OpenAI-Compatible Adapter              │
├──────────────┴──────────────┴───────────────┴──────────────────┤
│                         Prisma + SQLite                          │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Data Flow

1. **API Key Storage**:
   - User enters API key → Key encrypted with AES-256-GCM → Stored as (encryptedKey, iv, authTag)
   - Only last 4 chars visible after save; full key never returned to client

2. **Test Execution**:
   - Test selected → Variables substituted → Rate limit checked
   - Key decrypted (server-side only) → Provider adapter called
   - Response captured → Tokens counted → Cost calculated → Validation run
   - Run record created with all metrics

3. **Security Boundaries**:
   - API keys: Encrypted at rest, decrypted only for provider calls, never logged
   - Auth: Password hashed with bcrypt, sessions via HTTP-only JWT cookies
   - All provider calls: Server-side only (no client-side API access)

### Database Schema

- **User**: Authentication (email, hashed password)
- **ApiKey**: Encrypted API keys with provider info
- **Test**: Test definitions with prompts, variables, validation rules
- **Run**: Execution records with metrics and outputs
- **RateLimit**: Per-user rate limiting tracking

---

## Setup Guide

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Quick Start

1. **Clone and install dependencies**:
   \`\`\`bash
   cd ai_labs
   npm install
   \`\`\`

2. **Configure environment variables**:
   \`\`\`bash
   # Copy the example file
   cp .env.example .env
   
   # Generate encryption keys (run these commands)
   openssl rand -hex 32  # Copy output to APP_ENCRYPTION_KEY
   openssl rand -hex 32  # Copy output to JWT_SECRET
   
   # Edit .env with your generated keys
   \`\`\`

3. **Initialize the database**:
   \`\`\`bash
   npx prisma generate
   npx prisma db push
   \`\`\`

4. **Run the development server**:
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

6. **Create an account**:
   - Register with email/password
   - Add your AI provider API keys
   - Create your first test

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| \`DATABASE_URL\` | Yes | SQLite database path (default: \`file:./dev.db\`) |
| \`APP_ENCRYPTION_KEY\` | Yes | 64-char hex key for API key encryption |
| \`JWT_SECRET\` | Yes | 64-char hex key for session tokens |

### Generate Secure Keys

\`\`\`bash
# On macOS/Linux:
openssl rand -hex 32

# On Windows (PowerShell):
-join ((1..32) | ForEach-Object {'{0:X2}' -f (Get-Random -Max 256)})
\`\`\`

---

## Usage Guide

### Adding API Keys

1. Navigate to **API Keys** page
2. Click **Add API Key**
3. Enter a name, select provider, paste your key
4. For local/custom endpoints, enter the base URL (e.g., \`http://localhost:11434\`)
5. Click **Test** to verify the connection
6. Key is encrypted and stored; only last 4 chars visible

### Creating Tests

1. Navigate to **Tests** → **Create Test**
2. Enter test name and description
3. Write your prompt (use \`{{variableName}}\` for dynamic values)
4. Add default variables as JSON: \`{"name": "Alice", "task": "summarize"}\`
5. Optional: Add validation rules:
   - **Expected Contains**: String that must appear in output
   - **JSON Schema**: Schema for structured output validation

### Running Tests

1. Go to test detail page → **Run Test**
2. Select models to test against (provider + model + API key)
3. Override variables if needed
4. Set batch count (1-10 runs per model)
5. Toggle **Dry Run** to estimate cost without calling APIs
6. Click **Run Test**

### Comparing Models

1. Navigate to **Compare** page
2. Select a test
3. View side-by-side comparison of:
   - Pass rates
   - Average latency
   - Total cost
   - Output content

### Exporting Data

Export runs as JSON or CSV:
\`\`\`
/api/export?format=json
/api/export?format=csv
/api/export?format=json&testId=<test-id>
\`\`\`

---

## Folder Structure

\`\`\`
ai_labs/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/
│   │   ├── (authenticated)/  # Protected pages
│   │   │   ├── dashboard/
│   │   │   ├── keys/
│   │   │   ├── tests/
│   │   │   ├── runs/
│   │   │   └── compare/
│   │   ├── actions/         # Server actions
│   │   │   ├── auth.ts
│   │   │   ├── keys.ts
│   │   │   ├── tests.ts
│   │   │   └── runs.ts
│   │   ├── api/
│   │   │   └── export/      # Export route
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   └── navbar.tsx
│   └── lib/
│       ├── providers/       # Provider adapters
│       │   ├── index.ts     # Router
│       │   ├── types.ts     # Interfaces
│       │   ├── openai.ts
│       │   ├── anthropic.ts
│       │   ├── google.ts
│       │   ├── deepseek.ts
│       │   └── local.ts
│       ├── auth.ts          # Authentication
│       ├── db.ts            # Prisma client
│       ├── encryption.ts    # AES-256-GCM
│       ├── pricing.ts       # Cost estimation
│       ├── rate-limit.ts    # Rate limiting
│       ├── test-runner.ts   # Test orchestration
│       ├── utils.ts         # Utilities
│       └── validation.ts    # Pass/fail validation
├── .env                     # Environment variables
├── .env.example             # Example environment
└── package.json
\`\`\`

---

## Security Considerations

1. **API Keys**: Never stored in plaintext; AES-256-GCM encrypted with authenticated encryption
2. **Encryption Key**: Must be 32 bytes (64 hex chars); app fails to start if missing
3. **Passwords**: Hashed with bcrypt (12 rounds)
4. **Sessions**: HTTP-only cookies with JWT; 7-day expiry
5. **Provider Calls**: Server-side only; keys never sent to client
6. **Error Handling**: API keys are redacted from error messages

---

## Adding New Providers

1. Create adapter in \`src/lib/providers/\`:
   \`\`\`typescript
   export class NewProviderAdapter extends BaseProviderAdapter {
     readonly name = 'newprovider';
     readonly displayName = 'New Provider';
     
     async testConnection(apiKey: string): Promise<ProviderTestResult> { ... }
     async complete(request: ProviderRequest): Promise<ProviderResponse> { ... }
     getDefaultModel(): string { ... }
     getSupportedModels(): string[] { ... }
   }
   \`\`\`

2. Register in \`src/lib/providers/index.ts\`:
   \`\`\`typescript
   const newProvider = new NewProviderAdapter();
   adapters.set(newProvider.name, newProvider);
   \`\`\`

3. Add pricing in \`src/lib/pricing.ts\`:
   \`\`\`typescript
   newprovider: {
     name: 'newprovider',
     displayName: 'New Provider',
     defaultModel: 'model-name',
     models: {
       'model-name': { inputPer1M: 1.00, outputPer1M: 2.00 },
     },
   },
   \`\`\`

4. Add to provider select options in UI components

---

## Rate Limiting

Default: 10 runs per minute per user

To modify, edit \`MAX_RUNS_PER_MINUTE\` in \`src/lib/rate-limit.ts\`

---

## Migrating to PostgreSQL

1. Update \`schema.prisma\`:
   \`\`\`prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   \`\`\`

2. Update \`DATABASE_URL\` in \`.env\`:
   \`\`\`
   DATABASE_URL="postgresql://user:pass@localhost:5432/ailab"
   \`\`\`

3. Run migrations:
   \`\`\`bash
   npx prisma migrate dev
   \`\`\`

---

## License

MIT
