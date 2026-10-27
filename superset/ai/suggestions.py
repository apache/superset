# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Opening suggestions for an empty conversation.

Asking the model what is worth asking about *this* page produces better openers
than a fixed list, because it can name the actual charts, columns and filters on
screen. It also costs a model round trip on panel open, so it is off by default:
a deployment paying per token should opt in, and the client keeps a locally
derived fallback so the affordance never simply disappears.

Never raises. A failure here costs the user three suggestion chips, and must not
cost them the panel.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from superset.ai.llm.base import CompletionRequest, Message, ModelAlias
from superset.ai.page_context import render_page_context
from superset.ai.types import MessageRole
from superset.utils import json

logger = logging.getLogger(__name__)

#: The suggestion row has space for three chips before it wraps past one line.
MAX_SUGGESTIONS = 3

#: Suggestions are one-line questions; this is generous for three of them and
#: keeps a runaway model from turning an opener into an essay.
DEFAULT_MAX_OUTPUT_TOKENS = 300

#: A suggestion longer than this would be clipped in the chip anyway.
MAX_SUGGESTION_CHARS = 120

DEFAULT_INSTRUCTION = """\
You suggest opening questions for a data analyst who has just opened an \
assistant panel in Superset, a data exploration tool.

Given what is on their screen, propose up to {count} questions they would \
plausibly want answered right now.

Rules:
- Each question must be answerable using the data and metadata on the page.
- Name the specific chart, column, filter or table where you can.
- Keep each under {max_chars} characters, phrased as the user would type it.
- Prefer variety: do not propose three versions of the same question.
- Reply with a JSON array of strings and nothing else. No prose, no code fence.

If the screen shows nothing worth asking about, reply with an empty array.\
"""


def suggestions_enabled() -> bool:
    """Whether this deployment asks the model for openers."""
    return bool(_config("AI_SUGGESTED_PROMPTS_ENABLED", False))


def suggest_prompts(page_context: Any) -> list[str]:
    """
    Up to :data:`MAX_SUGGESTIONS` openers for the page the user is on.

    Returns an empty list when the feature is off, when there is no page context
    worth describing, or when anything at all goes wrong — the client falls back
    to its own derived list in every one of those cases, so an empty return is a
    normal outcome rather than an error to report.
    """
    if not suggestions_enabled():
        return []

    rendered = render_page_context(page_context)
    if not rendered:
        # Nothing on screen to be specific about, and a generic model-authored
        # list is no better than the client's own — and costs a round trip.
        return []

    try:
        return _ask(rendered)
    except Exception:  # pylint: disable=broad-except
        logger.warning("Could not generate prompt suggestions", exc_info=True)
        return []


def _ask(rendered_context: str) -> list[str]:
    """One round trip for a list of openers. See :func:`suggest_prompts`."""
    from superset.ai.factories import get_provider

    count = int(_config("AI_SUGGESTED_PROMPTS_COUNT", MAX_SUGGESTIONS))
    count = max(1, min(count, MAX_SUGGESTIONS))

    instruction = _config("AI_SUGGESTED_PROMPTS_PROMPT", None) or DEFAULT_INSTRUCTION
    system = instruction.format(count=count, max_chars=MAX_SUGGESTION_CHARS)

    request = CompletionRequest(
        messages=[Message(role=MessageRole.USER, content=rendered_context)],
        system=system,
        # The cheapest tier by default: this is a list of one-line questions, not
        # analysis, and it runs every time an empty panel is opened.
        model_alias=ModelAlias(_config("AI_SUGGESTED_PROMPTS_MODEL_ALIAS", "fast")),
        model=_config("AI_SUGGESTED_PROMPTS_MODEL", None),
        max_output_tokens=int(
            _config("AI_SUGGESTED_PROMPTS_MAX_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS)
        ),
    )

    provider = get_provider()
    # A fresh loop rather than ``asyncio.run``: this is called from a Flask
    # request thread, which has no running loop, and ``asyncio.run`` would also
    # cancel the provider's own background tasks on the way out.
    loop = asyncio.new_event_loop()
    try:
        response = loop.run_until_complete(provider.complete(request))
    finally:
        loop.close()

    return _parse(response.text, count)


def _parse(text: str, count: int) -> list[str]:
    """
    Read the model's reply as a list of questions.

    Tolerant on purpose. The reply is asked for as bare JSON, but a model that
    wraps it in a code fence or adds a line of preamble has still done the useful
    part, and a strict parse would throw that away.
    """
    if not (cleaned := text.strip()):
        return []

    # Strip a code fence if there is one, then take the outermost array.
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned).strip()
    if (start := cleaned.find("[")) != -1 and (end := cleaned.rfind("]")) > start:
        cleaned = cleaned[start : end + 1]

    try:
        parsed = json.loads(cleaned)
    except Exception:  # pylint: disable=broad-except
        logger.info("Prompt suggestions were not valid JSON; ignoring them")
        return []

    if not isinstance(parsed, list):
        return []

    suggestions: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        if not (candidate := item.strip()):
            continue
        # Deduplicated case-insensitively: a model asked for variety still
        # sometimes returns the same question twice with different casing.
        if any(existing.lower() == candidate.lower() for existing in suggestions):
            continue
        suggestions.append(candidate[:MAX_SUGGESTION_CHARS])
        if len(suggestions) == count:
            break
    return suggestions


def _config(key: str, default: Any) -> Any:
    """Read a config value, tolerating the absence of an app context."""
    try:
        from flask import current_app

        return current_app.config.get(key, default)
    except Exception:  # pylint: disable=broad-except
        return default
