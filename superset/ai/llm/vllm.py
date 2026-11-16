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
"""vLLM completions with exact accounting by the serving chat tokenizer."""

from __future__ import annotations

import logging
from typing import Any, ClassVar, TYPE_CHECKING
from urllib.parse import urlsplit

from superset.ai.llm.base import (
    CompletionRequest,
    LLMConfigurationError,
    LLMRequestError,
    LLMTransportError,
    RequestTokenCount,
)
from superset.ai.llm.openai_compatible import OpenAICompatibleProvider

if TYPE_CHECKING:
    import httpx

logger = logging.getLogger(__name__)


class VLLMProvider(OpenAICompatibleProvider):
    """Use vLLM's chat ``/tokenize`` endpoint for the same completion payload.

    ``tokenize_url`` is the explicit, full endpoint URL. It must serve the same
    model and chat template as ``base_url``, including when completions go through
    a gateway. Its optional ``tokenize_api_key`` and ``tokenize_headers`` are
    separate credentials; completion credentials are never copied to this URL.

    ``chat_template_kwargs`` is applied to both tokenization and completions.
    Omit it to use the serving deployment's template defaults in both requests.
    """

    name: ClassVar[str] = "vllm"
    supports_token_counting: ClassVar[bool] = True

    def __init__(self, **config: Any) -> None:
        super().__init__(**config)
        self._tokenize_client: httpx.AsyncClient | None = None

    def _payload(self, request: CompletionRequest) -> dict[str, Any]:
        payload = super()._payload(request)
        template_options: dict[str, Any] = {
            "add_generation_prompt": True,
            "continue_final_message": False,
            "add_special_tokens": False,
        }
        if (kwargs := self.config.get("chat_template_kwargs")) is not None:
            if not isinstance(kwargs, dict):
                raise LLMConfigurationError("chat_template_kwargs must be a mapping.")
            template_options["chat_template_kwargs"] = kwargs
        payload["extra_body"] = template_options
        return payload

    async def count_tokens(self, request: CompletionRequest) -> RequestTokenCount:
        """Render the complete request on the configured vLLM tokenizer."""
        # Build once with the completion serializer so that tool ordering,
        # system messages and explicit model selection cannot diverge.
        completion = self._payload(request)
        payload = {
            key: completion[key]
            for key in ("model", "messages", "tools")
            if key in completion
        }
        payload.update(completion["extra_body"])
        url = self._tokenize_url()
        client = self._counter_client()
        http = _httpx()
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        except http.HTTPStatusError as ex:
            status = ex.response.status_code
            error = (
                LLMTransportError
                if status in (408, 429) or status >= 500
                else LLMRequestError
            )
            # Response bodies can echo prompts, keys or internal gateway URLs.
            raise error(f"The token counter returned HTTP {status}.") from None
        except http.RequestError:
            raise LLMTransportError("The token counter could not be reached.") from None
        try:
            body = response.json()
            return RequestTokenCount(
                input_tokens=body["count"], context_window=body["max_model_len"]
            )
        except (KeyError, TypeError, ValueError):
            raise LLMRequestError(
                "The token counter returned an invalid count or context window."
            ) from None

    def _tokenize_url(self) -> str:
        """Require an explicit HTTP endpoint instead of guessing gateway routes."""
        url = self.config.get("tokenize_url")
        if isinstance(url, str):
            try:
                parsed = urlsplit(url)
                if (
                    parsed.scheme in ("http", "https")
                    and parsed.hostname
                    and not parsed.username
                    and not parsed.password
                    and not parsed.fragment
                ):
                    return url
            except ValueError:
                pass
        raise LLMConfigurationError(
            "Set AI_LLM_PROVIDER_CONFIG['tokenize_url'] to the full HTTP(S) "
            "tokenization endpoint for the serving vLLM model."
        )

    def _counter_client(self) -> httpx.AsyncClient:
        """Own a separate connection pool and credentials for tokenization."""
        if self._tokenize_client is None:
            http = _httpx()
            headers = http.Headers(self.config.get("tokenize_headers") or {})
            key = self.config.get("tokenize_api_key")
            if key:
                headers["Authorization"] = f"Bearer {key}"
            options: dict[str, Any] = {"headers": headers, "follow_redirects": False}
            if self.config.get("timeout_seconds") is not None:
                options["timeout"] = self.config["timeout_seconds"]
            self._tokenize_client = http.AsyncClient(**options)
        return self._tokenize_client

    async def aclose(self) -> None:
        """Close both pools and permit reuse in a later run's event loop."""
        client = self._tokenize_client
        self._tokenize_client = None
        try:
            if client is not None:
                await client.aclose()
        except Exception:  # pylint: disable=broad-except
            logger.debug(
                "The token counter client did not close cleanly", exc_info=True
            )
        finally:
            await super().aclose()


def _httpx() -> Any:
    """Keep the HTTP client optional for deployments without an AI provider."""
    try:
        import httpx
    except ImportError as ex:
        raise LLMConfigurationError(
            "The vLLM provider requires httpx. Install apache-superset[ai-openai]."
        ) from ex
    return httpx
