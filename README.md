<div align="center">

# 🧪 AI Lab

**Test and compare AI models across multiple providers in one place**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Architecture](#-architecture) • [Contributing](#-contributing)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔌 **Multi-Provider** | OpenAI, Anthropic, Google Gemini, DeepSeek, and Local (Ollama/LM Studio) |
| 🔍 **Dynamic Models** | Auto-discovers available models from your API keys |
| 📝 **Prompt Templates** | Create reusable prompts with `{{variables}}` |
| ⚡ **Batch Testing** | Run against multiple models simultaneously |
| 📊 **Compare Results** | Side-by-side output, latency, and cost comparison |
| ✅ **Validation** | Expected-contains and JSON schema validation |
| 💰 **Cost Tracking** | Real-time token usage and cost estimation |
| 🔒 **Secure Storage** | AES-256-GCM encrypted API keys |
| 🔄 **Rerun** | Re-execute runs individually or in batches |
| 🖼️ **SVG Preview** | Renders SVG outputs with copy functionality |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**

### Installation

```bash
# Clone the repo
git clone https://github.com/Luccama700/ai_labs.git
cd ai_labs

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

### Generate Encryption Keys

```bash
# Generate APP_ENCRYPTION_KEY
openssl rand -hex 32

# Generate JWT_SECRET  
openssl rand -hex 32
```

Add both keys to your `.env` file:

```env
DATABASE_URL="file:./dev.db"
APP_ENCRYPTION_KEY="your-64-char-hex-key"
JWT_SECRET="your-64-char-hex-key"
```

### Initialize & Run

```bash
# Set up database
npx prisma generate
npx prisma db push

# Start dev server
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 📖 Usage

### 1️⃣ Add API Keys

Navigate to **Dashboard** → **API Keys** section → **Add Key**

| Provider | What you need |
|----------|---------------|
| OpenAI | API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| Anthropic | API key from [console.anthropic.com](https://console.anthropic.com/) |
| Google | API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| DeepSeek | API key from [platform.deepseek.com](https://platform.deepseek.com/) |
| Local | Base URL (e.g., `http://localhost:11434` for Ollama) |

### 2️⃣ Create a Test

```
Tests → New Test
```

- **Name**: Descriptive test name
- **Prompt**: Your prompt text (use `{{variable}}` for dynamic values)
- **Variables**: Default values as JSON
- **Validation** (optional): Expected output strings or JSON schema

**Example prompt:**
```
Summarize the following text in {{style}} style:

{{text}}
```

### 3️⃣ Run Tests

1. Open your test → **Run Test**
2. Select models to compare
3. Override variables if needed
4. Click **Execute**

### 4️⃣ Compare Results

View results with:
- ✅ Pass/fail status
- ⏱️ Latency (ms)
- 🔢 Token counts
- 💵 Estimated cost
- 📄 Full output with SVG preview

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js 14 App Router                       │
├─────────────────────────────────────────────────────────────────┤
│  Pages                │  Server Actions      │  API Routes       │
│  • /dashboard         │  • auth.ts           │  • /api/export    │
│  • /tests             │  • keys.ts           │                   │
│  • /runs              │  • tests.ts          │                   │
│  • /compare           │  • runs.ts           │                   │
├─────────────────────────────────────────────────────────────────┤
│                        Core Libraries                            │
│  auth.ts │ encryption.ts │ test-runner.ts │ validation.ts       │
├─────────────────────────────────────────────────────────────────┤
│                     Provider Adapters                            │
│  OpenAI │ Anthropic │ Google │ DeepSeek │ Local                 │
├─────────────────────────────────────────────────────────────────┤
│                      Prisma + SQLite                             │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── app/
│   ├── (authenticated)/     # Protected routes
│   │   ├── dashboard/       # Main dashboard
│   │   ├── tests/           # Test CRUD & execution
│   │   ├── runs/            # Run history & details
│   │   └── compare/         # Model comparison
│   ├── actions/             # Server actions
│   ├── api/                 # REST endpoints
│   ├── login/               # Auth pages
│   └── register/
├── components/
│   └── ui/                  # Reusable components
├── lib/
│   ├── providers/           # AI provider adapters
│   ├── auth.ts              # JWT authentication
│   ├── encryption.ts        # AES-256-GCM
│   └── test-runner.ts       # Orchestration
└── prisma/
    └── schema.prisma        # Database schema
```

---

## 🔒 Security

| Layer | Implementation |
|-------|----------------|
| **API Keys** | AES-256-GCM encryption at rest |
| **Passwords** | bcrypt hashing (12 rounds) |
| **Sessions** | HTTP-only JWT cookies (7-day expiry) |
| **Provider Calls** | Server-side only, keys never exposed to client |

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | SQLite path: `file:./dev.db` |
| `APP_ENCRYPTION_KEY` | ✅ | 64-char hex for API key encryption |
| `JWT_SECRET` | ✅ | 64-char hex for session tokens |

### Rate Limiting

Default: **10 runs/minute** per user

Modify in `src/lib/rate-limit.ts`:
```typescript
const MAX_RUNS_PER_MINUTE = 10;
```

---

## 🔌 Adding Providers

1. Create adapter in `src/lib/providers/`:

```typescript
export class NewProviderAdapter extends BaseProviderAdapter {
  readonly name = 'newprovider';
  readonly displayName = 'New Provider';
  
  async testConnection(apiKey: string): Promise<ProviderTestResult> { ... }
  async complete(request: ProviderRequest): Promise<ProviderResponse> { ... }
  async fetchAvailableModels(apiKey: string): Promise<string[]> { ... }
}
```

2. Register in `src/lib/providers/index.ts`
3. Add pricing in `src/lib/pricing.ts`

---

## 📤 Export Data

```bash
# JSON export
GET /api/export?format=json

# CSV export  
GET /api/export?format=csv

# Filter by test
GET /api/export?format=json&testId=<id>
```

---

## 🗄️ Database Migration (PostgreSQL)

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```bash
# Update .env
DATABASE_URL="postgresql://user:pass@localhost:5432/ailab"

# Run migration
npx prisma migrate dev
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT © [Luccama700](https://github.com/Luccama700)

---

<div align="center">

**[⬆ Back to Top](#-ai-lab)**

Made with ❤️ for AI developers

</div>
