# Local LLM Integration — LM Studio + qwen3-coder

Two ways to use qwen3-coder from LM Studio for coding on this project.

---

## Option A — `lm_code.py` (used from Cowork)

Run coding tasks directly against LM Studio from a terminal or from Cowork's Bash tool.
The VM can reach your Mac's LM Studio at `192.168.64.1:1234`.

### Usage

```bash
# Ask it to modify a single file
python3 lm_code.py "Add loading skeleton to ProviderCard" src/components/ProviderCard.tsx

# Pass multiple files as context
python3 lm_code.py "Refactor search to use useCallback" \
  src/pages/Directory.tsx \
  src/components/SearchBar.tsx

# Just ask a question (no file writes)
python3 lm_code.py --print-only "What does the stem() function do?"

# List models currently loaded in LM Studio
python3 lm_code.py --list-models

# Use a different model for one task
python3 lm_code.py --model qwen/qwen2.5-coder-14b "Fix the type error in useCenters"

# Read task from a file (useful for long prompts)
python3 lm_code.py --task-file my_task.txt src/pages/Directory.tsx
```

### Environment variables

| Variable   | Default                  | Description              |
|------------|--------------------------|--------------------------|
| `LM_HOST`  | `192.168.64.1`           | Host running LM Studio   |
| `LM_PORT`  | `1234`                   | LM Studio API port       |
| `LM_MODEL` | `qwen/qwen3-coder-30b`   | Model to use             |

---

## Option B — Claude Code CLI with LM Studio backend

This routes the `claude` CLI tool through LM Studio so every coding request goes to qwen3-coder.

### Step 1 — Start the proxy (on your Mac)

```bash
# In a dedicated terminal on your Mac:
chmod +x lm_proxy.sh
./lm_proxy.sh
# Proxy starts on http://localhost:4000
```

### Step 2 — Run Claude Code pointing at the proxy

```bash
# In a new terminal:
ANTHROPIC_BASE_URL=http://localhost:4000 \
ANTHROPIC_API_KEY=lm-studio \
claude
```

Or add to `~/.zshrc` to make it permanent:

```bash
export ANTHROPIC_BASE_URL=http://localhost:4000
export ANTHROPIC_API_KEY=lm-studio
```

Then just run `claude` normally — it will use qwen3-coder automatically.

### Notes

- LM Studio must be running before you start the proxy.
- The proxy translates Anthropic API format → OpenAI format for LM Studio.
- `--drop_params` strips unsupported Claude-specific params so qwen doesn't error.
- To switch back to real Claude, just unset the env vars or close the proxy.

---

## Switching models mid-session (Option A)

```bash
# Use the faster 8B for quick edits, 30B for complex refactors
LM_MODEL=qwen/qwen3-8b python3 lm_code.py "Fix the typo in Footer.tsx" src/components/layout/Footer.tsx
```

## How Cowork uses it

When you ask Cowork to make a code change and qwen3-coder is preferred, Cowork can delegate like this:

```bash
python3 lm_code.py "Your task here" path/to/file.tsx
```

The script reads the file, sends it to qwen3-coder with the task, and writes the result back. Cowork then reviews and verifies the output.
