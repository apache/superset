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
Tests for system prompt assembly and the core sections.

The layering tests matter more than they look. A split enforced by convention
rather than by code drifts silently, and a test that only checked the happy path
would pass just as happily on a contaminated prompt. Each rule is therefore
tested in both directions: it rejects what it should, and it permits what it
should.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from superset.ai.knowledge import (
    KnowledgeDomain,
    KnowledgeProvider,
    NullKnowledgeProvider,
)
from superset.ai.prompts import (
    assemble_system_prompt,
    build_time_anchor,
    CORE_ONLY_KINDS,
    CORE_SOURCE,
    find_unmarked_tool_references,
    order_sections,
    PromptAssemblyError,
    PromptContext,
    PromptSection,
    SectionKind,
)
from superset.ai.prompts.core import core_sections

DEPLOYMENT_SOURCE = "acme.knowledge"

#: Database engines. Naming one in core is a subtle failure: the prompt still
#: reads as generic advice, but the assistant emits that engine's syntax against
#: whatever is actually configured and cannot tell it has. Dialect guidance
#: belongs to a KnowledgeProvider, keyed by the backend in play.
#:
#: These are all publicly known products, so listing them discloses nothing. A
#: deployment that also wants to bar its own internal vocabulary should keep that
#: list with its own configuration rather than here — enumerating private system
#: names in a public test publishes exactly what it is trying to protect.
ENGINE_DENYLIST = (
    "presto",
    "pinot",
    "trino",
    "hive",
    "spark",
    "snowflake",
    "bigquery",
    "redshift",
    "databricks",
    "athena",
    "druid",
    "clickhouse",
)

#: Any ``scheme://`` construction.
ABSOLUTE_URL_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9+.\-]*://\S+")

#: A bare hostname, which the URL pattern above does not catch. Restricted to
#: the suffixes an internal address is most likely to carry.
BARE_HOSTNAME_RE = re.compile(
    r"\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|dev|internal|local|corp)\b",
    re.IGNORECASE,
)


def _section(**kwargs: Any) -> PromptSection:
    """A section with sane defaults, so each test states only what it varies."""
    defaults: dict[str, Any] = {
        "key": "test.section",
        "body": "Answer the question that was asked.",
        "kind": SectionKind.KNOWLEDGE,
        "source": DEPLOYMENT_SOURCE,
    }
    return PromptSection(**{**defaults, **kwargs})


def _package_files() -> list[Path]:
    """Every Python file this package ships, for the denylist sweep."""
    root = Path(__file__).resolve().parents[3] / "superset" / "ai"
    return [*(root / "prompts").rglob("*.py"), root / "knowledge.py"]


# --------------------------------------------------------------------------- #
# Layering: only core may supply a process layer
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("kind", sorted(CORE_ONLY_KINDS, key=lambda k: k.value))
def test_core_only_kind_rejects_a_deployment_source(kind: SectionKind) -> None:
    """A deployment cannot smuggle domain content into a process layer."""
    section = _section(kind=kind, source=DEPLOYMENT_SOURCE)

    with pytest.raises(PromptAssemblyError, match="only 'superset.core'"):
        assemble_system_prompt([section], tool_names=())


@pytest.mark.parametrize("kind", sorted(CORE_ONLY_KINDS, key=lambda k: k.value))
def test_core_only_kind_accepts_the_core_source(kind: SectionKind) -> None:
    """The same kinds are exactly what core itself is allowed to supply."""
    section = _section(kind=kind, source=CORE_SOURCE, body="Be careful.")

    assert assemble_system_prompt([section], tool_names=()) == "Be careful."


@pytest.mark.parametrize("kind", [SectionKind.SKILL, SectionKind.KNOWLEDGE])
def test_content_kinds_accept_a_deployment_source(kind: SectionKind) -> None:
    """Skill and knowledge are the supported channels for a deployment."""
    section = _section(kind=kind, source=DEPLOYMENT_SOURCE, body="Our data.")

    assert assemble_system_prompt([section], tool_names=()) == "Our data."


# --------------------------------------------------------------------------- #
# Core sections must stay deployment-independent
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "body",
    [
        "Open https://analytics.example.com/dashboard to check.",
        "The catalogue lives at http://catalog.internal/browse.",
        "Connect via warehouse-db://reporting/analytics for details.",
    ],
)
def test_core_section_rejects_an_absolute_url(body: str) -> None:
    """An address is a deployment fact, however process-shaped its sentence."""
    section = _section(kind=SectionKind.PROCESS, source=CORE_SOURCE, body=body)

    with pytest.raises(PromptAssemblyError, match="absolute URL"):
        assemble_system_prompt([section], tool_names=())


@pytest.mark.parametrize(
    "body",
    [
        "Link to the dataset the tool returned rather than composing a URL.",
        "Use the address the tool gave you; do not rewrite its host.",
        "Ratios such as 0.5 and abbreviations such as e.g. are fine.",
    ],
)
def test_core_section_accepts_prose_without_a_url(body: str) -> None:
    """The URL rule must not fire on prose that merely discusses links."""
    section = _section(kind=SectionKind.PROCESS, source=CORE_SOURCE, body=body)

    assert assemble_system_prompt([section], tool_names=()) == body


@pytest.mark.parametrize(
    "body",
    [
        "Read counts FROM reporting.daily_totals before answering.",
        "Then JOIN warehouse.accounts on the user key.",
        "The canonical source is `analytics_prod.fact_orders`.",
    ],
)
def test_core_section_rejects_a_schema_qualified_identifier(body: str) -> None:
    """Both routes a table name takes into a prompt are closed."""
    section = _section(kind=SectionKind.PROCESS, source=CORE_SOURCE, body=body)

    with pytest.raises(PromptAssemblyError, match="schema-qualified"):
        assemble_system_prompt([section], tool_names=())


@pytest.mark.parametrize(
    "body",
    [
        "Filter on the partition column, written as <schema>.<table> here.",
        "Select from the newest partition only.",
        "Aggregating across partitions double-counts, e.g. on a snapshot table.",
        "Filter to a single partition and alias it as `latest` in the output.",
    ],
)
def test_core_section_accepts_generic_sql_guidance(body: str) -> None:
    """Placeholders, plain prose and abbreviations must not trip the check."""
    section = _section(kind=SectionKind.PROCESS, source=CORE_SOURCE, body=body)

    assert assemble_system_prompt([section], tool_names=()) == body


def test_deployment_section_may_name_tables_and_urls() -> None:
    """
    The checks are scoped to core on purpose.

    A deployment's knowledge section exists precisely to name its own tables and
    point at its own catalogue; applying the core rules to it would make the
    extension seam useless.
    """
    body = "Deposits live in `finance_prod.deposits`; docs at https://wiki.example.com."
    section = _section(kind=SectionKind.KNOWLEDGE, source=DEPLOYMENT_SOURCE, body=body)

    assert assemble_system_prompt([section], tool_names=()) == body


# --------------------------------------------------------------------------- #
# Tool references
# --------------------------------------------------------------------------- #


def test_tool_marker_resolves_to_the_registry_name() -> None:
    """A marked reference renders as the plain backticked tool name."""
    section = _section(body="Run it with `tool:run_sql` and check the rows.")

    prompt = assemble_system_prompt([section], tool_names=["run_sql", "get_schema"])

    assert prompt == "Run it with `run_sql` and check the rows."


def test_unknown_tool_marker_raises() -> None:
    """
    A renamed tool fails assembly instead of shipping.

    Without this, a prompt naming a tool that no longer exists reaches the model
    and the only remedy is patching the text at runtime — which is how prompt
    constants end up edited by string replacement from another module.
    """
    section = _section(body="Call `tool:execute_sql_local` first.")

    with pytest.raises(PromptAssemblyError, match="execute_sql_local"):
        assemble_system_prompt([section], tool_names=["run_sql"])


def test_unmarked_tool_reference_is_reported_by_the_lint() -> None:
    """A bare backticked tool name is drift waiting to happen."""
    section = _section(body="Call `run_sql`, then `tool:get_schema`.")

    assert find_unmarked_tool_references(section, ["run_sql", "get_schema"]) == (
        "run_sql",
    )


def test_marked_tool_reference_passes_the_lint() -> None:
    """The marker is what distinguishes a checked reference from a literal."""
    section = _section(body="Call `tool:run_sql` and then `tool:get_schema`.")

    assert find_unmarked_tool_references(section, ["run_sql", "get_schema"]) == ()


# --------------------------------------------------------------------------- #
# Ordering, duplicates, mutator
# --------------------------------------------------------------------------- #


def test_sections_render_in_order_regardless_of_input_order() -> None:
    """Order is a property of the sections, not of registration timing."""
    sections = [
        _section(key="b", body="second", order=20),
        _section(key="a", body="first", order=10),
        _section(key="c", body="third", order=30),
    ]

    assert assemble_system_prompt(sections, tool_names=()) == "first\n\nsecond\n\nthird"


def test_equal_orders_break_on_key() -> None:
    """Ties resolve deterministically so the prompt is reproducible."""
    sections = [
        _section(key="zebra", body="z", order=10),
        _section(key="alpha", body="a", order=10),
    ]

    assert assemble_system_prompt(sections, tool_names=()) == "a\n\nz"


def test_duplicate_keys_raise() -> None:
    """
    Two providers claiming one key is an error, not a silent override.

    Last-one-wins would produce a prompt that either repeats itself or
    contradicts itself, with nothing to indicate which.
    """
    sections = [
        _section(key="same", body="one"),
        _section(key="same", body="two", source="other.provider"),
    ]

    with pytest.raises(PromptAssemblyError, match="Duplicate prompt section key"):
        order_sections(sections)


def test_empty_bodies_are_dropped() -> None:
    """A section that renders to nothing must not leave a blank gap."""
    sections = [
        _section(key="a", body="kept", order=10),
        _section(key="b", body="   \n  ", order=20),
    ]

    assert assemble_system_prompt(sections, tool_names=()) == "kept"


def test_mutator_runs_last_and_sees_the_inputs() -> None:
    """
    The escape hatch receives the finished prompt plus what produced it.

    It runs after validation deliberately: a deployment overriding the house
    rules is allowed to add the things core may not.
    """
    seen: dict[str, Any] = {}

    def mutator(
        prompt: str,
        *,
        sections: tuple[PromptSection, ...],
        context: PromptContext,
    ) -> str:
        seen["keys"] = [section.key for section in sections]
        seen["profile"] = context.profile_key
        return f"{prompt}\n\nHouse style: no jargon."

    prompt = assemble_system_prompt(
        [_section(key="a", body="Answer directly.")],
        tool_names=(),
        mutator=mutator,
        context=PromptContext(profile_key="analyst"),
    )

    assert prompt.endswith("House style: no jargon.")
    assert prompt.startswith("Answer directly.")
    assert seen == {"keys": ["a"], "profile": "analyst"}


# --------------------------------------------------------------------------- #
# Time anchor
# --------------------------------------------------------------------------- #


def test_time_anchor_states_the_weekday_and_declares_itself_authoritative() -> None:
    """
    Both halves matter.

    Models derive a weekday from a date badly and confidently, so the anchor
    supplies it; and it has to say it is authoritative or the model will still
    prefer its own arithmetic.
    """
    anchor = build_time_anchor("UTC")

    assert "(UTC)" in anchor
    assert "authoritative" in anchor
    assert re.search(r"\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b", anchor)


def test_time_anchor_honours_an_explicit_timezone() -> None:
    """A caller that knows the timezone does not have to go through config."""
    assert "(Asia/Tokyo)" in build_time_anchor("Asia/Tokyo")


def test_time_anchor_reads_the_config_key(app: Any) -> None:
    """The deployment's choice is picked up without a code change."""
    app.config["AI_ASSISTANT_TIMEZONE"] = "Europe/Berlin"
    try:
        assert "(Europe/Berlin)" in build_time_anchor()
    finally:
        del app.config["AI_ASSISTANT_TIMEZONE"]


def test_time_anchor_defaults_to_utc_when_unconfigured(app: Any) -> None:
    """
    The key is read defensively.

    A deployment that has not set it, or is running an older config, must still
    get an anchor -- and it must be UTC rather than an assumed office timezone.
    """
    app.config.pop("AI_ASSISTANT_TIMEZONE", None)

    assert "(UTC)" in build_time_anchor()


def test_time_anchor_falls_back_on_an_unknown_timezone() -> None:
    """A configuration typo degrades the anchor; it does not fail the run."""
    assert "(UTC)" in build_time_anchor("Mars/Olympus_Mons")


# --------------------------------------------------------------------------- #
# The shipped core sections
# --------------------------------------------------------------------------- #


def test_core_sections_are_all_sourced_to_core() -> None:
    """Anything in this package is core by definition."""
    assert {section.source for section in core_sections()} == {CORE_SOURCE}


def test_core_sections_assemble() -> None:
    """
    The shipped prompt passes its own rules.

    Assembly performs the URL, identifier and layering checks, so a section that
    picked up a table name or a hostname fails here.
    """
    prompt = assemble_system_prompt(core_sections(), tool_names=())

    assert prompt
    assert len(prompt.splitlines()) > 40


def test_core_sections_have_unique_keys() -> None:
    """Ordering is only deterministic if the keys are distinct."""
    sections = core_sections()

    assert len({section.key for section in sections}) == len(sections)


def test_core_prompt_stays_small() -> None:
    """
    A ceiling, not a target.

    Everything here is paid on every request, so growth belongs behind the
    knowledge tool rather than in the always-on prompt. Raise this only with a
    reason.
    """
    prompt = assemble_system_prompt(core_sections(), tool_names=())

    assert len(prompt) < 17_000, f"core prompt grew to {len(prompt)} characters"


@pytest.mark.parametrize("term", ENGINE_DENYLIST)
def test_no_database_engine_is_named_in_the_package(term: str) -> None:
    """
    Core query guidance stays engine-neutral.

    An engine name in core produces syntax that is confidently wrong on every
    other deployment, with nothing to signal it. Dialect rules are supplied per
    engine by a KnowledgeProvider instead.
    """
    for path in _package_files():
        text = path.read_text(encoding="utf-8").lower()
        assert term not in text, f"{path} names database engine {term!r}"


def test_no_absolute_urls_or_hostnames_in_core_bodies() -> None:
    """
    No address of any shape reaches the model.

    Checked on the bodies rather than the files because the licence header
    legitimately carries a URL.
    """
    for section in core_sections():
        assert not ABSOLUTE_URL_RE.search(section.body), section.key
        assert not BARE_HOSTNAME_RE.search(section.body), section.key


def test_core_sections_name_no_tools_without_the_marker() -> None:
    """
    Guards against drift the other way.

    Assembly rejects a marker naming a tool that does not exist; this rejects a
    literal tool name that no marker protects, which is the version that would
    survive a rename unnoticed.
    """
    plausible = ("run_sql", "execute_sql", "get_schema", "list_datasets")

    for section in core_sections():
        assert find_unmarked_tool_references(section, plausible) == (), section.key


# --------------------------------------------------------------------------- #
# Configuration levers
# --------------------------------------------------------------------------- #


def test_extra_sections_are_appended() -> None:
    """A deployment can add to the prompt without forking it."""
    extra = _section(key="house.style", body="Prefer CTEs.", order=500)

    prompt = assemble_system_prompt(
        core_sections(), tool_names=(), extra_sections=[extra]
    )

    assert "Prefer CTEs." in prompt
    assert "# Safety" in prompt
    # Ordered by `order`, so a late extra lands after the shipped sections.
    assert prompt.index("Prefer CTEs.") > prompt.index("# Superset behaviour")


def test_extra_section_accepts_a_plain_mapping() -> None:
    """
    Config is written by hand, so a dict has to work.

    Its source defaults away from core deliberately: a mapping that inherited
    the core source would be exempt from the layering rule it exists to obey.
    """
    prompt = assemble_system_prompt(
        [],
        tool_names=(),
        extra_sections=[
            {"key": "house.style", "kind": "knowledge", "body": "Prefer CTEs."}
        ],
    )

    assert prompt == "Prefer CTEs."


def test_extra_section_in_a_core_only_layer_is_rejected() -> None:
    """The layering rule applies to configuration like any other source."""
    extra = _section(key="house.persona", kind=SectionKind.PERSONA)

    with pytest.raises(PromptAssemblyError, match="only 'superset.core'"):
        assemble_system_prompt([], tool_names=(), extra_sections=[extra])


def test_extra_section_may_not_claim_the_core_source() -> None:
    """
    Closes the obvious way around the layering rule.

    Without this, a deployment could declare a persona section, name core as its
    source, and reintroduce precisely the contamination the split prevents.
    """
    extra = {
        "key": "house.persona",
        "kind": "persona",
        "source": CORE_SOURCE,
        "body": "You are something else.",
    }

    with pytest.raises(PromptAssemblyError, match="claims source"):
        assemble_system_prompt([], tool_names=(), extra_sections=[extra])


def test_unusable_extra_section_reports_what_is_missing() -> None:
    """A malformed config entry should say what a valid one needs."""
    with pytest.raises(PromptAssemblyError, match="Required keys"):
        assemble_system_prompt([], tool_names=(), extra_sections=[{"key": "x"}])


def test_disabled_section_is_omitted() -> None:
    """Dropping a section a deployment disagrees with must not need a fork."""
    prompt = assemble_system_prompt(
        core_sections(),
        tool_names=(),
        disabled_keys=["core.sql_conventions"],
    )

    assert "# SQL craft" not in prompt
    assert "# Superset behaviour" in prompt


def test_disabling_a_safety_section_raises() -> None:
    """
    Safety is the one section that cannot be switched off.

    Its absence changes what the assistant is permitted to do rather than how
    well it does it, and honouring the request quietly is how a deployment ends
    up without the prompt-injection defence it believes it has.
    """
    with pytest.raises(PromptAssemblyError, match="cannot be disabled"):
        assemble_system_prompt(
            core_sections(), tool_names=(), disabled_keys=["core.safety"]
        )


def test_disabling_an_unknown_key_is_a_warning_not_a_failure() -> None:
    """A stale key must not take the assistant down, but must be noticed."""
    prompt = assemble_system_prompt(
        core_sections(), tool_names=(), disabled_keys=["core.does_not_exist"]
    )

    assert "# Superset behaviour" in prompt


def test_full_override_replaces_everything_but_still_runs_the_mutator() -> None:
    """
    The bluntest lever.

    A deployment that takes over the prompt also takes over the safety and
    grounding rules it displaced -- hence the loud warning in config -- but the
    mutator still runs so house style remains composable.
    """
    prompt = assemble_system_prompt(
        core_sections(),
        tool_names=(),
        override="You are a terse assistant.",
        mutator=lambda prompt, *, sections, context: f"{prompt} Be British.",
    )

    assert prompt == "You are a terse assistant. Be British."
    assert "# Safety" not in prompt


def test_override_is_read_from_config(app: Any) -> None:
    """Callers get configured behaviour without passing anything."""
    app.config["AI_SYSTEM_PROMPT"] = "Configured prompt."
    try:
        assert assemble_system_prompt(core_sections(), tool_names=()) == (
            "Configured prompt."
        )
    finally:
        del app.config["AI_SYSTEM_PROMPT"]


def test_extra_and_disabled_are_read_from_config(app: Any) -> None:
    """Both list levers resolve from config when not passed explicitly."""
    app.config["AI_EXTRA_PROMPT_SECTIONS"] = [
        {"key": "house.style", "kind": "knowledge", "body": "Prefer CTEs."}
    ]
    app.config["AI_DISABLED_PROMPT_SECTIONS"] = ["core.sql_conventions"]
    try:
        prompt = assemble_system_prompt(core_sections(), tool_names=())
    finally:
        del app.config["AI_EXTRA_PROMPT_SECTIONS"]
        del app.config["AI_DISABLED_PROMPT_SECTIONS"]

    assert "Prefer CTEs." in prompt
    assert "# SQL craft" not in prompt


def test_missing_config_keys_are_tolerated(app: Any) -> None:
    """
    Read defensively.

    A deployment on a config file predating these keys must still get a prompt,
    so absence has to behave exactly like the documented default.
    """
    for key in (
        "AI_SYSTEM_PROMPT",
        "AI_EXTRA_PROMPT_SECTIONS",
        "AI_DISABLED_PROMPT_SECTIONS",
    ):
        app.config.pop(key, None)

    assert "# Safety" in assemble_system_prompt(core_sections(), tool_names=())


def test_config_defaults_leave_the_prompt_untouched() -> None:
    """The shipped defaults must be a no-op, not a behaviour change."""
    from superset import config

    assert config.AI_EXTRA_PROMPT_SECTIONS == []
    assert config.AI_DISABLED_PROMPT_SECTIONS == []
    assert config.AI_SYSTEM_PROMPT is None


# --------------------------------------------------------------------------- #
# The knowledge seam
# --------------------------------------------------------------------------- #


def test_null_provider_contributes_nothing() -> None:
    """Core ships no domain knowledge, and the default proves it."""
    provider = NullKnowledgeProvider()

    assert provider.prompt_sections(PromptContext()) == ()
    assert provider.domains() == ()
    assert isinstance(provider, KnowledgeProvider)


def test_a_provider_contributes_an_index_and_on_demand_bodies() -> None:
    """
    The shape the seam is designed around.

    A small always-on index plus bodies behind a tool: measured on the
    implementation this derives from at roughly a quarter of the input tokens
    for comparable accuracy.
    """

    class SalesKnowledge:
        name = DEPLOYMENT_SOURCE

        def prompt_sections(self, ctx: PromptContext) -> tuple[PromptSection, ...]:
            return (
                PromptSection(
                    key="acme.index",
                    body="Domains: sales (orders, returns).",
                    kind=SectionKind.KNOWLEDGE,
                    source=self.name,
                    order=200,
                ),
            )

        def domains(self) -> tuple[KnowledgeDomain, ...]:
            return (
                KnowledgeDomain(
                    key="sales",
                    title="Sales",
                    summary="Order and return volumes.",
                    body="Orders live in `sales_prod.orders`.",
                    tags=("revenue",),
                ),
            )

    provider: KnowledgeProvider = SalesKnowledge()
    sections = [*core_sections(), *provider.prompt_sections(PromptContext())]
    prompt = assemble_system_prompt(sections, tool_names=())

    assert "Domains: sales (orders, returns)." in prompt
    # The body stays out of the always-on prompt; a tool serves it.
    assert "sales_prod.orders" not in prompt
    assert provider.domains()[0].key == "sales"
