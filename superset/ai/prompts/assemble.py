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
System prompt assembly.

A system prompt is a list of :class:`PromptSection` objects rather than a
concatenation of module-level strings. The type carries the two facts that make
the pile auditable: which layer a section belongs to (:class:`SectionKind`) and
who wrote it (``source``).

That pairing exists to prevent a failure mode this kind of prompt invites. A
layer documented as "process guidance only, never domain facts" and enforced by
convention loses to convention: deployment-specific table names, hostnames and
business metrics accumulate in it, and nothing catches them because nothing is
checking. Tool guidance rots the same way, and patching it by string replacement
against another module's constant makes the pile harder to reason about, not
easier.

:func:`assemble_system_prompt` turns all of that into errors:

* Only ``superset.core`` may contribute a safety, persona, process or format
  section. A deployment's own content must be a skill or knowledge section, so
  it lands in a layer that is expected to name concrete things.
* A core section may not contain an absolute URL or a schema-qualified table
  identifier, because both are deployment facts masquerading as process advice.
* A core section refers to a tool through a marker that is resolved against the
  live tool registry, so a renamed tool is an exception at assembly time rather
  than a prompt that quietly instructs the model to call something that no
  longer exists.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Collection, Iterable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol
from zoneinfo import available_timezones, ZoneInfo

from superset.utils.backports import StrEnum

logger = logging.getLogger(__name__)

#: ``source`` value reserved for sections shipped by Superset itself. Only
#: sections carrying it may occupy the core-only layers.
CORE_SOURCE = "superset.core"

#: Timezone used for the date anchor when the deployment has not chosen one.
#: UTC and not a market or office timezone: core has no opinion about where the
#: reader is, and a wrong opinion silently shifts every "yesterday" by a day.
DEFAULT_TIMEZONE = "UTC"

#: Config key holding the deployment's preferred timezone for the date anchor.
TIMEZONE_CONFIG_KEY = "AI_ASSISTANT_TIMEZONE"

#: Default ``source`` for a section supplied as a mapping in configuration. Not
#: :data:`CORE_SOURCE`: config-supplied content must be subject to the layering
#: rule, and defaulting it to core would exempt it.
CONFIG_SOURCE = "superset_config"


class SectionKind(StrEnum):
    """
    Which layer of the prompt a section belongs to.

    The first four are process layers: they describe how to behave and are
    reserved for Superset core. The last two are content layers: they name
    concrete things and are the supported way for a deployment to contribute.
    """

    #: Non-negotiable limits. Placed first so nothing later can appear to
    #: override it.
    SAFETY = "safety"
    #: Who the assistant is and how it spends effort.
    PERSONA = "persona"
    #: How to work: grounding, discovery discipline, turn budget.
    PROCESS = "process"
    #: How to shape the answer.
    FORMAT = "format"
    #: A reusable workflow for a class of task.
    SKILL = "skill"
    #: Facts. Table catalogues, metric definitions, product behaviour.
    KNOWLEDGE = "knowledge"


#: Kinds a deployment may not supply. Content from outside core has to declare
#: itself as content, which is what keeps domain facts out of the layers that
#: are meant to be portable.
CORE_ONLY_KINDS: frozenset[SectionKind] = frozenset(
    {
        SectionKind.SAFETY,
        SectionKind.PERSONA,
        SectionKind.PROCESS,
        SectionKind.FORMAT,
    }
)

#: How a section body cites a tool: a backticked name carrying this prefix,
#: for example ``run_sql`` written as the marker below. Assembly checks the name
#: against the live registry and rewrites the marker to the plain backticked
#: name, so section text never hardcodes a tool name.
TOOL_REFERENCE_PREFIX = "tool:"

_TOOL_REFERENCE_RE = re.compile(rf"`{TOOL_REFERENCE_PREFIX}([A-Za-z_][A-Za-z0-9_]*)`")

#: Any ``scheme://`` construction. A core section that needs to point somewhere
#: should describe the destination; the concrete address is a deployment fact.
_ABSOLUTE_URL_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9+.\-]*://\S+")

#: A dotted identifier in a position where SQL expects a relation. The trailing
#: lookahead keeps prose abbreviations such as "e.g." from matching.
_SCHEMA_QUALIFIED_RE = re.compile(
    r"""
    \b(?:from|join|into|update|table)\b     # keyword that introduces a relation
    \s+
    ["'`]?
    (
        [A-Za-z_][A-Za-z0-9_]*
        (?:\.[A-Za-z_][A-Za-z0-9_]*)+
    )
    (?![.\w])
    """,
    re.IGNORECASE | re.VERBOSE,
)

#: A dotted identifier called out as code. This is how a table name usually
#: reaches a prompt: quoted inline in a sentence rather than inside SQL.
_BACKTICKED_DOTTED_RE = re.compile(
    r"`([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+)`"
)


class PromptAssemblyError(Exception):
    """A section violates the layering rules, so no prompt is produced."""


@dataclass(frozen=True)
class PromptSection:
    """
    One block of the system prompt.

    Frozen because the same section object is shared between the assembler, the
    validators and the tests; a mutable body could pass validation and then be
    edited before rendering.
    """

    #: Stable identifier, unique within one assembly. Used in error messages
    #: and by a deployment that wants to replace a specific block.
    key: str
    #: The text handed to the model. May contain tool reference markers.
    body: str
    #: Which layer this belongs to.
    kind: SectionKind
    #: Who supplied it: :data:`CORE_SOURCE`, or a knowledge provider's name.
    source: str = CORE_SOURCE
    #: Ascending render order. Ties break on ``key`` so assembly is
    #: deterministic regardless of registration order.
    order: int = 100

    @property
    def is_core(self) -> bool:
        """Whether Superset itself supplied this section."""
        return self.source == CORE_SOURCE


@dataclass(frozen=True)
class PromptContext:
    """
    What a section author or mutator may branch on.

    Deliberately small and additive. Every field has a default so that a caller
    with partial information can still build a context, and so that adding a
    field later is not a breaking change for existing providers.
    """

    #: Tool names available for this run, as the registry spells them.
    tool_names: tuple[str, ...] = ()
    #: Key of the agent profile being assembled for.
    profile_key: str = ""
    #: Role names held by the requesting user.
    user_roles: tuple[str, ...] = ()
    #: ``db_engine_spec`` backends reachable in this deployment.
    database_backends: tuple[str, ...] = ()
    #: Anything a deployment's own providers agreed to pass among themselves.
    extra: Mapping[str, Any] = field(default_factory=dict)


class PromptMutator(Protocol):
    """
    Signature of the ``AI_SYSTEM_PROMPT_MUTATOR`` callable.

    Mirrors the shape of Superset's other mutator hooks: it receives the
    finished artefact plus the structured inputs that produced it, and returns
    the replacement. It runs last, after ordering, validation and tool
    resolution, so it can append, redact or reorder without owning assembly.

    Because it runs after validation, a mutator is trusted: it can reintroduce
    absolute URLs or table names on purpose. That is the point of an escape
    hatch, and the reason it is a separate hook rather than a section source.
    """

    def __call__(
        self,
        prompt: str,
        *,
        sections: tuple[PromptSection, ...],
        context: PromptContext,
    ) -> str: ...


def validate_core_section(section: PromptSection) -> None:
    """
    Check that a core-sourced section stays deployment-independent.

    Raises :class:`PromptAssemblyError` on an absolute URL or a
    schema-qualified table identifier. Both are things that are true of one
    deployment and false of the next, and both are how a prompt meant to be
    generic quietly accumulates facts about a single warehouse.

    A no-op for sections that did not come from core: a deployment's knowledge
    section is *supposed* to name its own tables and link to its own catalogue.
    """
    if not section.is_core:
        return

    if match := _ABSOLUTE_URL_RE.search(section.body):
        raise PromptAssemblyError(
            f"Core prompt section {section.key!r} contains an absolute URL "
            f"({match.group(0)!r}). Addresses differ per deployment: describe "
            f"the destination, or have the tool that knows the address return "
            f"a link."
        )

    for pattern in (_SCHEMA_QUALIFIED_RE, _BACKTICKED_DOTTED_RE):
        if match := pattern.search(section.body):
            raise PromptAssemblyError(
                f"Core prompt section {section.key!r} names a schema-qualified "
                f"identifier ({match.group(1)!r}). Core ships no domain "
                f"knowledge: use a placeholder, or move the fact into a "
                f"knowledge section supplied by a KnowledgeProvider."
            )


def find_unmarked_tool_references(
    section: PromptSection,
    tool_names: Collection[str],
) -> tuple[str, ...]:
    """
    Find tool names quoted in a body without the reference marker.

    A lint rather than an assembly-time error, because whether a backticked
    word is a tool name depends on the registry a deployment happens to load,
    and a naming coincidence should not break a running prompt. Superset's own
    test suite runs it over the core sections so drift is caught in CI, where
    the registry is known.
    """
    marked = {f"`{TOOL_REFERENCE_PREFIX}{name}`" for name in tool_names}
    stripped = section.body
    for marker in marked:
        stripped = stripped.replace(marker, "")
    return tuple(sorted(name for name in tool_names if f"`{name}`" in stripped))


def _resolve_tool_references(
    section: PromptSection,
    tool_names: Collection[str],
) -> str:
    """
    Replace tool markers with plain backticked names, rejecting unknown ones.

    This is the structural fix for tool-name drift. The alternative that was
    actually shipped upstream was a ``str.replace`` applied to another module's
    prompt constant to correct a tool name it had outgrown; nothing detected
    the next such rename.
    """
    available = set(tool_names)

    def substitute(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in available:
            raise PromptAssemblyError(
                f"Prompt section {section.key!r} references tool {name!r}, "
                f"which is not in the tool registry for this run. Known "
                f"tools: {', '.join(sorted(available)) or '(none)'}."
            )
        return f"`{name}`"

    return _TOOL_REFERENCE_RE.sub(substitute, section.body)


def _check_layering(section: PromptSection) -> None:
    """Reject deployment content in a core-only layer."""
    if section.kind in CORE_ONLY_KINDS and not section.is_core:
        raise PromptAssemblyError(
            f"Prompt section {section.key!r} from {section.source!r} declares "
            f"kind {section.kind.value!r}, which only {CORE_SOURCE!r} may "
            f"supply. Deployment-supplied content must be "
            f"{SectionKind.SKILL.value!r} or {SectionKind.KNOWLEDGE.value!r}."
        )


def order_sections(sections: Iterable[PromptSection]) -> tuple[PromptSection, ...]:
    """
    Sort sections for rendering and reject duplicate keys.

    Duplicate keys are an error rather than a last-one-wins override because
    the two most likely causes -- a provider registered twice, and two
    providers that chose the same key -- both produce a prompt that says the
    same thing twice or contradicts itself, silently.
    """
    ordered = sorted(sections, key=lambda section: (section.order, section.key))
    seen: dict[str, str] = {}
    for section in ordered:
        if section.key in seen:
            raise PromptAssemblyError(
                f"Duplicate prompt section key {section.key!r}, supplied by "
                f"both {seen[section.key]!r} and {section.source!r}."
            )
        seen[section.key] = section.source
    return tuple(ordered)


def _config_value(key: str, default: Any) -> Any:
    """
    Read one config key without requiring an application context.

    Prompt assembly also runs in tests and offline tooling where there is no
    Flask app, and a deployment may be on a config predating these keys. Neither
    is a reason to be unable to build a prompt.
    """
    try:
        from flask import current_app

        return current_app.config.get(key, default)
    except (ImportError, RuntimeError, KeyError):
        return default


def coerce_section(value: PromptSection | Mapping[str, Any]) -> PromptSection:
    """
    Accept a section from configuration, as an object or a plain mapping.

    A mapping defaults to :data:`CONFIG_SOURCE` rather than to
    :data:`CORE_SOURCE`, and an explicit claim of core is refused. Otherwise
    ``AI_EXTRA_PROMPT_SECTIONS`` would be a way around the layering rule: a
    deployment could declare a persona section, claim core as its source, and
    reintroduce exactly the contamination this module exists to prevent.
    """
    section = value if isinstance(value, PromptSection) else None
    if section is None:
        mapping = value
        if not isinstance(mapping, Mapping):
            raise PromptAssemblyError(
                f"Extra prompt section must be a PromptSection or a mapping, "
                f"got {type(value).__name__}."
            )
        try:
            section = PromptSection(
                key=mapping["key"],
                body=mapping["body"],
                kind=SectionKind(mapping["kind"]),
                source=mapping.get("source", CONFIG_SOURCE),
                order=mapping.get("order", 100),
            )
        except (KeyError, TypeError, ValueError) as ex:
            raise PromptAssemblyError(
                f"Could not build a prompt section from {mapping!r}: {ex}. "
                f"Required keys are 'key', 'body' and 'kind'."
            ) from ex

    if section.is_core:
        raise PromptAssemblyError(
            f"Extra prompt section {section.key!r} claims source "
            f"{CORE_SOURCE!r}. Configuration-supplied sections must name their "
            f"own source so the layering rule can apply to them."
        )
    return section


def _apply_disabled(
    sections: tuple[PromptSection, ...],
    disabled: Collection[str],
) -> tuple[PromptSection, ...]:
    """
    Drop sections a deployment has switched off, refusing to drop safety.

    A deployment that disagrees with a section should be able to remove it
    without forking. Safety is the exception: it is the one section whose absence
    changes what the assistant is permitted to do rather than how well it does
    it, and silently honouring a request to remove it is how a deployment ends up
    without prompt-injection defences it believes it has.
    """
    if not disabled:
        return sections

    requested = set(disabled)
    protected = sorted(
        section.key
        for section in sections
        if section.key in requested and section.kind is SectionKind.SAFETY
    )
    if protected:
        raise PromptAssemblyError(
            f"Prompt section(s) {', '.join(protected)} carry kind "
            f"{SectionKind.SAFETY.value!r} and cannot be disabled. Use "
            f"AI_SYSTEM_PROMPT_MUTATOR to adjust the wording, or "
            f"AI_SYSTEM_PROMPT to take over the prompt entirely and own its "
            f"safety rules."
        )

    kept = tuple(section for section in sections if section.key not in requested)
    if unknown := requested - {section.key for section in sections}:
        logger.warning(
            "AI_DISABLED_PROMPT_SECTIONS names unknown section key(s) %s; "
            "check the spelling, since nothing was removed for them",
            ", ".join(sorted(unknown)),
        )
    return kept


def assemble_system_prompt(  # noqa: C901
    sections: Iterable[PromptSection],
    *,
    tool_names: Collection[str],
    mutator: PromptMutator | None = None,
    context: PromptContext | None = None,
    separator: str = "\n\n",
    extra_sections: Iterable[PromptSection | Mapping[str, Any]] | None = None,
    disabled_keys: Collection[str] | None = None,
    override: str | None = None,
) -> str:
    """
    Render an ordered, validated system prompt.

    Three configuration levers are honoured, in increasing order of bluntness:
    ``AI_EXTRA_PROMPT_SECTIONS`` adds, ``AI_DISABLED_PROMPT_SECTIONS`` removes,
    and ``AI_SYSTEM_PROMPT`` replaces. Each has a matching argument; passing
    ``None`` reads the config key, and passing a value explicitly overrides it,
    so callers get configured behaviour by default and tests can be exact.

    :param sections: Sections to render, in any order.
    :param tool_names: Tool names available for this run, exactly as the
        registry spells them. Every tool reference marker in every section is
        resolved against this collection.
    :param mutator: Optional last-mile hook, applied to the finished string.
        See :class:`PromptMutator` for the signature; ``None`` skips it.
    :param context: Structured inputs, forwarded to ``mutator``. Defaults to a
        context carrying only ``tool_names``.
    :param separator: Text placed between rendered sections.
    :param extra_sections: Additional sections, as objects or mappings. Must be
        skill or knowledge, and must not claim core as their source.
    :param disabled_keys: Section keys to omit. A key naming a safety section is
        refused.
    :param override: Complete replacement text. When present, no section is
        rendered at all and this string is used verbatim -- the deployment then
        owns the safety and grounding rules it has displaced. The mutator still
        runs.
    :raises PromptAssemblyError: on a layering violation, a duplicate key, an
        absolute URL or schema-qualified identifier in a core section, a
        reference to a tool that does not exist, an unusable extra section, or
        an attempt to disable a safety section.
    """
    resolved_override = (
        override if override is not None else _config_value("AI_SYSTEM_PROMPT", None)
    )
    resolved_extra = (
        extra_sections
        if extra_sections is not None
        else _config_value("AI_EXTRA_PROMPT_SECTIONS", ())
    )
    resolved_disabled = (
        disabled_keys
        if disabled_keys is not None
        else _config_value("AI_DISABLED_PROMPT_SECTIONS", ())
    )

    if resolved_override:
        if resolved_extra or resolved_disabled:
            logger.warning(
                "AI_SYSTEM_PROMPT replaces the whole prompt, so "
                "AI_EXTRA_PROMPT_SECTIONS and AI_DISABLED_PROMPT_SECTIONS are "
                "ignored for this run"
            )
        ordered: tuple[PromptSection, ...] = ()
        prompt = str(resolved_override)
    else:
        combined = [*sections, *(coerce_section(item) for item in resolved_extra)]
        ordered = _apply_disabled(order_sections(combined), resolved_disabled)

        rendered: list[str] = []
        for section in ordered:
            _check_layering(section)
            validate_core_section(section)
            body = _resolve_tool_references(section, tool_names).strip()
            if body:
                rendered.append(body)

        prompt = separator.join(rendered)

    resolved_context = context or PromptContext(tool_names=tuple(tool_names))
    if mutator is not None:
        prompt = mutator(prompt, sections=ordered, context=resolved_context)

    return prompt


def _configured_timezone() -> str:
    """
    Read the deployment's timezone without requiring an application context.

    Read defensively on purpose: this is called from prompt assembly, which
    also runs in tests and offline tooling where there is no Flask app, and a
    missing config key must not be the reason a prompt cannot be built.
    """
    try:
        from flask import current_app

        value = current_app.config.get(TIMEZONE_CONFIG_KEY, DEFAULT_TIMEZONE)
    except (ImportError, RuntimeError, KeyError):
        return DEFAULT_TIMEZONE
    return value if isinstance(value, str) and value else DEFAULT_TIMEZONE


def build_time_anchor(tz: str | None = None) -> str:
    """
    Build the authoritative date line.

    Models are poor at deriving a weekday from a date and will assert one with
    complete confidence, so the prompt states both and declares them
    authoritative. Every other date in a session is then arithmetic from this
    anchor rather than a guess, which is what makes "last Tuesday" and
    "week to date" reproducible.

    :param tz: IANA timezone name. ``None`` reads
        ``AI_ASSISTANT_TIMEZONE`` from config, defaulting to UTC. An
        unrecognised name falls back to UTC with a warning rather than
        failing the run: a typo in configuration should degrade the anchor,
        not remove the assistant.
    """
    name = tz or _configured_timezone()
    if name not in available_timezones():
        logger.warning(
            "Unknown timezone %r for %s; falling back to %s",
            name,
            TIMEZONE_CONFIG_KEY,
            DEFAULT_TIMEZONE,
        )
        name = DEFAULT_TIMEZONE

    stamp = datetime.now(ZoneInfo(name))
    return (
        f"**Date: {stamp:%A %Y-%m-%d} ({name}). This date and weekday are "
        f"authoritative. Derive every other date and weekday arithmetically "
        f"from this anchor and never guess one. When a date matters to the "
        f"answer, say which timezone it is in.**"
    )
