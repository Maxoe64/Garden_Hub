# SeedGuide - AI-Powered Growing Assistant

A website that leverages AI to help people grow their own food. Input a seed and get personalized growing guides with equipment lists, timelines, and step-by-step instructions. Connects people to local library resources (seed libraries, tool lending, grow lights).

## Features

- **Browse & Select Seeds** — 12 common vegetables, herbs, and fruits with full growing details
- **Personalized Growing Guides** — Customized by space (indoor/balcony/yard/garden), experience level, and start date
- **AI Chat Assistant** — RAG-powered gardening Q&A with 50+ plants in the knowledge base
- **Open-Source LLM Support** — Run locally with Ollama (Llama 3, Mistral, etc.) or use Anthropic Claude
- **Web Search** — DuckDuckGo integration for live gardening info (no API key needed)
- **My Garden Planner** — Track planted seeds with progress bars and next-step reminders
- **Calendar Reminders** — Download .ics files for any calendar app
- **Library Resources** — Seed libraries, tool lending, Master Gardener programs

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. (Optional) Install Ollama for local AI: https://ollama.ai
ollama pull llama3.2

# 3. Run the app
python app.py

# 4. Open http://localhost:8080
```

## AI Configuration

### Option A: Ollama (Local, Free)
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.2    # or mistral, phi, gemma, etc.
python app.py           # auto-detects Ollama
```

### Option B: Anthropic Claude (Cloud)
```bash
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-key-here
python app.py
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | AI provider: `ollama` or `anthropic` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Default Ollama model |
| `ANTHROPIC_API_KEY` | (none) | Anthropic API key |
| `WEB_SEARCH_ENABLED` | `true` | Enable DuckDuckGo web search |
| `PORT` | `8080` | Server port |
