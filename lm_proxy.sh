#!/bin/bash
# lm_proxy.sh — Start a LiteLLM proxy that bridges Claude Code CLI → LM Studio
#
# This makes Claude Code CLI (and any Anthropic-SDK tool) use your local
# qwen3-coder model instead of Anthropic's API.
#
# Run this on your Mac BEFORE starting Claude Code:
#
#   chmod +x lm_proxy.sh
#   ./lm_proxy.sh
#
# Then in a new terminal, run Claude Code with:
#
#   ANTHROPIC_BASE_URL=http://localhost:4000 \
#   ANTHROPIC_API_KEY=lm-studio \
#   claude
#
# Or set them permanently in ~/.zshrc:
#   export ANTHROPIC_BASE_URL=http://localhost:4000
#   export ANTHROPIC_API_KEY=lm-studio

set -e

MODEL="${LM_MODEL:-qwen/qwen3-coder-30b}"
LM_PORT="${LM_PORT:-1234}"
PROXY_PORT="${PROXY_PORT:-4000}"

echo "Starting LiteLLM proxy..."
echo "  LM Studio model : $MODEL"
echo "  LM Studio port  : $LM_PORT"
echo "  Proxy port      : $PROXY_PORT"
echo ""
echo "Once running, use Claude Code with:"
echo "  ANTHROPIC_BASE_URL=http://localhost:$PROXY_PORT ANTHROPIC_API_KEY=lm-studio claude"
echo ""

# Install litellm if not present
if ! command -v litellm &> /dev/null; then
    echo "Installing litellm..."
    pip install litellm --quiet
fi

litellm \
    --model "openai/$MODEL" \
    --api_base "http://localhost:$LM_PORT/v1" \
    --api_key "lm-studio" \
    --port "$PROXY_PORT" \
    --drop_params \
    --add_function_to_prompt
