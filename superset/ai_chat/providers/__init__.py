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
"""Provider registry and factory for the AI chat gateway."""

from __future__ import annotations

from typing import Any

from superset.ai_chat.exceptions import AiChatConfigurationError
from superset.ai_chat.providers.anthropic_provider import AnthropicProvider
from superset.ai_chat.providers.base import BaseChatProvider, ProviderSettings
from superset.ai_chat.providers.mock import MockChatProvider
from superset.ai_chat.providers.openai_compat import OpenAiCompatibleProvider

PROVIDERS: dict[str, type[BaseChatProvider]] = {
    "mock": MockChatProvider,
    "openai_compatible": OpenAiCompatibleProvider,
    "anthropic": AnthropicProvider,
}


def get_provider(config: dict[str, Any]) -> BaseChatProvider:
    """Build and validate the configured provider.

    Raises :class:`AiChatConfigurationError` on an unknown provider name or
    missing credentials, and returns no secrets to the caller beyond the
    provider instance itself.
    """
    settings = ProviderSettings.from_config(config)
    provider_cls = PROVIDERS.get(settings.provider)
    if provider_cls is None:
        raise AiChatConfigurationError(
            f"Unknown AI chat provider {settings.provider!r}. Valid values: "
            f"{', '.join(sorted(PROVIDERS))}."
        )
    provider = provider_cls(settings)
    provider.validate_settings()
    return provider


def is_provider_configured(config: dict[str, Any]) -> bool:
    """Whether the configured provider passes validation, leaking no secrets."""
    try:
        get_provider(config)
        return True
    except AiChatConfigurationError:
        return False
