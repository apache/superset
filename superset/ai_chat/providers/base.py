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
"""Model provider interface for the AI chat gateway.

Providers translate the neutral conversation format in
:mod:`superset.ai_chat.types` to a vendor wire format and back. The
orchestrator and the frontend never see vendor-specific shapes, which keeps
the UI decoupled from any one model vendor.
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, TYPE_CHECKING

from superset.ai_chat.exceptions import (
    AiChatConfigurationError,
    AiChatProviderError,
    AiChatProviderTimeoutError,
)
from superset.ai_chat.types import ChatMessage, ProviderResult, ToolSpec

if TYPE_CHECKING:
    import httpx

logger = logging.getLogger(__name__)


@dataclass
class ProviderSettings:
    """Server-side provider settings resolved from ``AI_CHAT_CONFIG``.

    ``api_key`` is read at request time from the environment variable named by
    ``API_KEY_ENV_VAR``, and never appears in a response, event or log the
    gateway produces.
    """

    provider: str
    model: str | None
    api_key: str | None
    base_url: str | None
    max_output_tokens: int
    timeout_seconds: int

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> ProviderSettings:
        """Build settings from AI_CHAT_CONFIG.

        The API key is read from the environment variable the operator names,
        never from the configuration file and never from a request.
        """
        api_key = None
        if env_var := config.get("API_KEY_ENV_VAR"):
            api_key = os.environ.get(env_var) or None
        return cls(
            provider=config.get("PROVIDER") or "mock",
            model=config.get("MODEL"),
            api_key=api_key,
            base_url=config.get("BASE_URL"),
            max_output_tokens=int(config.get("MAX_OUTPUT_TOKENS") or 4096),
            timeout_seconds=int(config.get("REQUEST_TIMEOUT_SECONDS") or 120),
        )


def require_httpx(provider_label: str) -> Any:
    """Import ``httpx`` or raise a browser-safe configuration error.

    ``httpx`` ships with the optional ``fastmcp`` extra, so HTTP-backed
    providers degrade with an actionable message instead of an ImportError.
    """
    try:
        import httpx
    except ImportError as ex:
        raise AiChatProviderError(
            f"The httpx package is required for the {provider_label} "
            "provider. Install the 'fastmcp' extra."
        ) from ex
    return httpx


#: Attempts allowed while adapting the payload to a model's requirements. A
#: model can reject more than one parameter, as gpt-5.x rejects both
#: ``max_tokens`` and a non-zero reasoning effort alongside function tools,
#: and reports each rejection only once the previous one is fixed.
MAX_PAYLOAD_ATTEMPTS = 4

#: Given ``(status_code, body, payload)``, returns an adapted payload to try
#: again, or None to accept the failure.
PayloadAdapter = Callable[[int, Any, dict[str, Any]], dict[str, Any] | None]


async def post_json(
    client: httpx.AsyncClient,
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str],
    provider_label: str,
    adapt: PayloadAdapter | None = None,
) -> dict[str, Any]:
    """POST *payload* and return the decoded JSON body.

    Centralizes the rule that provider responses never reach the browser:
    bodies are logged truncated at warning level, and callers see only a
    sanitized error carrying the status code.

    ``adapt`` lets a provider respond to a rejected parameter with a corrected
    payload. It is applied repeatedly because a model reports only the first
    offending parameter, revealing the next once that one is fixed.
    """
    httpx = require_httpx(provider_label)
    try:
        response = await client.post(url, json=payload, headers=headers)
        attempts = 1
        while (
            response.status_code != 200
            and adapt is not None
            and attempts < MAX_PAYLOAD_ATTEMPTS
        ):
            try:
                body = response.json()
            except ValueError:
                break
            adapted = adapt(response.status_code, body, payload)
            if adapted is None:
                break
            logger.info(
                "%s provider retrying with an adapted payload (attempt %s)",
                provider_label,
                attempts + 1,
            )
            payload = adapted
            response = await client.post(url, json=payload, headers=headers)
            attempts += 1
    except httpx.TimeoutException as ex:
        raise AiChatProviderTimeoutError() from ex
    except httpx.HTTPError as ex:
        logger.warning("%s provider request failed: %s", provider_label, ex)
        raise AiChatProviderError() from ex

    if response.status_code != 200:
        # Response bodies can carry sensitive detail, so log them truncated at
        # warning level and return a sanitized error.
        logger.warning(
            "%s provider returned %s: %.500s",
            provider_label,
            response.status_code,
            response.text,
        )
        raise AiChatProviderError(
            f"The AI model provider returned an error (HTTP {response.status_code})."
        )
    return response.json()


def normalize_usage(usage_raw: Mapping[str, Any] | None) -> dict[str, int] | None:
    """Keep only integer usage counters, dropping vendor-specific extras."""
    usage = {
        key: value for key, value in (usage_raw or {}).items() if isinstance(value, int)
    }
    return usage or None


class BaseChatProvider(ABC):
    """One conversation turn against a model provider."""

    #: Whether the provider requires an API key to operate
    requires_api_key = True

    def __init__(self, settings: ProviderSettings) -> None:
        self.settings = settings

    def validate_settings(self) -> None:
        """Raise :class:`AiChatConfigurationError` when settings are unusable."""
        if self.requires_api_key and not self.settings.api_key:
            raise AiChatConfigurationError(
                "The AI chat provider requires an API key. Set "
                "AI_CHAT_CONFIG['API_KEY_ENV_VAR'] to the name of an "
                "environment variable holding the key."
            )

    @abstractmethod
    async def complete(
        self,
        messages: list[ChatMessage],
        tools: list[ToolSpec],
    ) -> ProviderResult:
        """Run one completion over the neutral message format.

        Implementations must raise :class:`AiChatProviderError`, or a
        subclass, with a browser-safe message on failure. Raw provider
        responses may be logged server-side but never propagated.
        """
