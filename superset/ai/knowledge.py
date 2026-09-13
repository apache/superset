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
The seam through which a deployment teaches the assistant about its own data.

Superset core ships no domain knowledge: it does not know which table holds
signups, what "active user" means here, or which of three similarly named
datasets is the certified one. Those facts are the most valuable thing a
deployment can give the assistant and the least portable thing imaginable, so
they arrive through a provider rather than through a patch to core.

**SQL dialect and engine guidance belongs here too.** Core's query guidance names
no engine and contains no dialect syntax, because a prompt asserting one engine's
functions, catalog layout or partition-metadata spelling produces confidently
invalid SQL against the next -- and the assistant cannot tell that it has. A
deployment that wants the assistant to know its engines supplies that as a
knowledge domain per engine, keyed so it can be fetched once the backend in play
is known.

A provider contributes on two channels, and the split is the whole design:

``prompt_sections``
    Always-on text, present on every request. Keep it to an *index*: the names
    of the domains that exist, one line each, and how to fetch more.

``domains``
    The bodies. Served on demand by a tool when the assistant decides it needs
    one.

Putting a full catalogue in the always-on channel is the obvious thing to do and
it is a mistake: every turn then pays for every domain, whether or not the
question touches it, and the prompt grows without bound as a deployment documents
more of its warehouse. The opposite extreme fails too — with no catalogue
reachable at all, the assistant guesses at table names — so the knowledge is
load-bearing and the tool is not optional. Index in the prompt, body behind a
tool.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from superset.ai.prompts.assemble import PromptContext, PromptSection


@dataclass(frozen=True)
class KnowledgeDomain:
    """
    One on-demand body of domain knowledge.

    A domain is the unit the assistant asks for by name, so it should be the
    size of a topic a single question lives inside -- one subject area, one
    engine's dialect rules, one team's metric definitions -- rather than
    everything the deployment knows.
    """

    #: Stable identifier the assistant passes to the tool that serves bodies.
    key: str
    #: Short human-readable name.
    title: str
    #: One line, suitable for the always-on index. This is what the assistant
    #: reads when deciding whether the body is worth fetching, so it should say
    #: what questions the domain answers rather than describe its contents.
    summary: str
    #: The full text, returned by the tool. Costs nothing until requested.
    body: str
    #: Free-form labels for matching a question to a domain.
    tags: tuple[str, ...] = field(default_factory=tuple)


@runtime_checkable
class KnowledgeProvider(Protocol):
    """
    A source of deployment-specific knowledge.

    Registered through ``AI_KNOWLEDGE_PROVIDERS``. Implementations are read
    during prompt assembly and while serving the knowledge tool, so both
    methods must be cheap and side-effect free; anything expensive belongs
    behind the provider's own cache.
    """

    #: Identifier used as the ``source`` of contributed sections and in logs.
    #: Must not be ``superset.core``: sections from a provider are content, not
    #: process, and assembly rejects a provider claiming a core-only layer.
    name: str

    def prompt_sections(self, ctx: PromptContext) -> Sequence[PromptSection]:
        """
        Always-on sections, included in every system prompt.

        Keep these small -- an index, not a catalogue. Every token here is paid
        on every request, including the requests that never touch this domain.
        Return an empty sequence to be purely on-demand.

        Sections must declare ``kind`` as skill or knowledge and ``source`` as
        this provider's ``name``.
        """
        ...

    def domains(self) -> Sequence[KnowledgeDomain]:
        """
        Bodies served on demand by the knowledge tool.

        This is where a table catalogue, a metric glossary or a set of dialect
        notes belongs, however large. The assistant pays for a domain only in
        the turns where it asked for one.
        """
        ...


class NullKnowledgeProvider:
    """
    The shipped default: no domain knowledge at all.

    Core deliberately knows nothing about any particular warehouse, and an
    empty provider is how that stays true. It also means the assembly path,
    the knowledge tool and the tests all exercise the same code whether or not
    a deployment has configured anything.
    """

    name = "superset.null"

    def prompt_sections(self, ctx: PromptContext) -> Sequence[PromptSection]:
        """No always-on knowledge."""
        return ()

    def domains(self) -> Sequence[KnowledgeDomain]:
        """No on-demand knowledge."""
        return ()
