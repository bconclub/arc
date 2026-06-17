"""Claude wrapper: JSON-mode, retry, token budget."""
from __future__ import annotations

import json
import time
from typing import Any

import anthropic
from arc.config import ANTHROPIC_API_KEY

_client: anthropic.Anthropic | None = None

MODEL = "claude-sonnet-4-6"
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds, doubles each retry


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def call(
    system: str,
    user: str,
    max_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    """
    Call Claude, return the text response.
    json_mode=True: prepends JSON instruction and validates the response parses.
    """
    if json_mode:
        system = system + "\n\nRespond with valid JSON only. No explanation, no markdown fences."

    for attempt in range(MAX_RETRIES):
        try:
            response = client().messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = response.content[0].text.strip()
            if json_mode:
                # Strip accidental markdown fences
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()
                # Validate
                json.loads(text)
            return text
        except anthropic.RateLimitError:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (2 ** attempt))
            else:
                raise
        except json.JSONDecodeError as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            raise ValueError(f"Claude returned invalid JSON after {MAX_RETRIES} attempts: {e}") from e


def call_json(system: str, user: str, max_tokens: int = 1024) -> Any:
    """Call Claude and return parsed JSON object."""
    text = call(system, user, max_tokens=max_tokens, json_mode=True)
    return json.loads(text)
