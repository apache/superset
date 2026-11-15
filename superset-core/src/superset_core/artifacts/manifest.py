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
The artifact manifest (``manifest.json``, E7): what an artifact asks of its host.

The manifest declares the artifact's named data bindings, the data events it
emits, the capabilities it needs, its npm dependencies and the provenance of
any snapshot data. The host validates it on every write, and builds every
query from the stored manifest as the viewer, never from anything the frame
sends (DR-08, DR-10). Events are checked against it before Canvas applies
them (DR-11).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Annotated, Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.store import normalize_path

MANIFEST_VERSION = "1"
# Where the manifest lives in an artifact's file tree.
MANIFEST_FILE = "manifest.json"

SLUG_MAX_LENGTH = 64
NPM_NAME_MAX_LENGTH = 214

_SLUG = re.compile(r"[a-z][a-z0-9_]*")
# npm's rules for new package names: lowercase, URL-safe, no leading dot or
# underscore, and an optional ``@scope/`` prefix.
_NPM_NAME = re.compile(r"(?:@[a-z0-9-][a-z0-9._-]*/)?[a-z0-9-][a-z0-9._-]*")
_NPM_RESERVED_NAMES = frozenset({"node_modules", "favicon.ico"})
# An exact semantic version, with an optional pre-release and no build
# metadata. Ranges, tags, URLs and git, ``file:`` or ``npm:`` specs never
# match. ``[0-9]`` rather than ``\d``, which matches non-ASCII digits too.
_IDENTIFIER = r"(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
_EXACT_VERSION = re.compile(
    r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
    rf"(?:-{_IDENTIFIER}(?:\.{_IDENTIFIER})*)?"
)

StrictPositiveInt = Annotated[int, Field(strict=True, gt=0)]
NonEmptyStr = Annotated[str, Field(min_length=1)]
ParameterType = Literal[
    "string", "number", "boolean", "date", "time_range", "string_list"
]
EventKind = Literal["cross_filter", "selection", "highlight", "drill"]


def _slug_error(kind: str, name: str) -> str | None:
    if len(name) <= SLUG_MAX_LENGTH and _SLUG.fullmatch(name):
        return None
    return (
        f"{kind} name {name!r} must be a slug: lowercase letters, digits and "
        f"underscores, starting with a letter, at most {SLUG_MAX_LENGTH} "
        "characters"
    )


def _raise_errors(errors: Iterable[str]) -> None:
    """Raise one ``ValueError`` that lists every problem, if there are any."""
    if problems := list(errors):
        raise ValueError("; ".join(problems))


def _check_slugs(kind: str, names: Iterable[str]) -> None:
    _raise_errors(error for name in names if (error := _slug_error(kind, name)))


def _dependency_error(name: str, version: str) -> str | None:
    if (
        len(name) > NPM_NAME_MAX_LENGTH
        or name in _NPM_RESERVED_NAMES
        or not _NPM_NAME.fullmatch(name)
    ):
        return f"{name!r} is not a valid npm package name"
    if not _EXACT_VERSION.fullmatch(version):
        return (
            f"dependency {name!r}: {version!r} is not an exact version; pin one "
            "such as 1.2.3 or 1.2.3-beta.1 (no ranges, tags, URLs, git or "
            "file: specs)"
        )
    return None


class _ManifestModel(BaseModel):
    """
    Base of the manifest's models: undeclared fields are rejected, so a
    misspelled key fails validation instead of being ignored.
    """

    model_config = ConfigDict(extra="forbid")


class DatasetSource(_ManifestModel):
    """A binding source: a Superset dataset, by id."""

    kind: Literal["dataset"]
    dataset_id: StrictPositiveInt


class SavedChartSource(_ManifestModel):
    """A binding source: a saved chart, by id; the binding reuses its query."""

    kind: Literal["chart"]
    chart_id: StrictPositiveInt


class SemanticViewSource(_ManifestModel):
    """A binding source: a semantic view, whose metrics are defined centrally."""

    kind: Literal["semantic_view"]
    semantic_view: NonEmptyStr


BindingSource = Annotated[
    DatasetSource | SavedChartSource | SemanticViewSource,
    Field(discriminator="kind"),
]


class ParameterSpec(_ManifestModel):
    """
    A value the artifact may change when it asks for a binding's data again.

    The frame sends only values for declared parameters; the server rebuilds
    the query from the stored manifest with them.
    """

    type: ParameterType
    required: bool = False
    default: Any = None
    # When set, the only values the parameter accepts.
    allowed: list[Any] | None = None

    # TODO(S8): check default, allowed and incoming values against ``type``.


class Binding(_ManifestModel):
    """
    A named binding to Superset data, run on the server as the viewer (R5).

    The result reaches the frame with the definitions and formats of its
    metrics and dimensions.
    """

    # Bindings shaped like SIP-231's ``SemanticQuery`` are review finding D1,
    # pending; until it's decided, a binding names its metrics and dimensions.

    source: BindingSource
    metrics: list[NonEmptyStr] = Field(default_factory=list)
    dimensions: list[NonEmptyStr] = Field(default_factory=list)
    filters: list[dict[str, Any]] = Field(default_factory=list)
    parameters: dict[str, ParameterSpec] = Field(default_factory=dict)
    # TODO(T16): an upper bound, once query limits are decided.
    row_limit: StrictPositiveInt | None = None

    @field_validator("parameters")
    @classmethod
    def _parameter_names_are_slugs(
        cls, parameters: dict[str, ParameterSpec]
    ) -> dict[str, ParameterSpec]:
        _check_slugs("parameter", parameters)
        return parameters


class EventDecl(_ManifestModel):
    """
    A data event the artifact emits: its kind, on one dimension of one binding.

    ``cross_filter`` events need the ``cross_filter`` capability; the other
    kinds need ``events``.
    """

    kind: EventKind
    binding: str
    dimension: str


class SnapshotProvenance(_ManifestModel):
    """
    Where a binding's snapshot (static) data came from, and when (R10).

    A snapshot is captured with its author's access, not the viewer's, so its
    provenance is mandatory.
    """

    binding: str
    captured_at: AwareDatetime
    captured_by: str | None = None
    row_count: int = Field(strict=True, ge=0)


class ArtifactManifest(_ManifestModel):
    """
    An artifact's ``manifest.json``.

    Validation reports every cross-field problem at once: references to
    undeclared bindings and dimensions, and capabilities the declarations
    need but the manifest doesn't declare.
    """

    artifact_version: Literal["1"]
    entrypoint: str = "index.html"
    title: str | None = None
    bindings: dict[str, Binding] = Field(default_factory=dict)
    events: list[EventDecl] = Field(default_factory=list)
    capabilities: list[Capability] = Field(default_factory=list)
    # npm package name to exact version (R4, DR-09).
    dependencies: dict[str, str] = Field(default_factory=dict)
    snapshots: list[SnapshotProvenance] = Field(default_factory=list)

    @field_validator("entrypoint")
    @classmethod
    def _entrypoint_is_a_tree_path(cls, entrypoint: str) -> str:
        return normalize_path(entrypoint)

    @field_validator("bindings")
    @classmethod
    def _binding_names_are_slugs(
        cls, bindings: dict[str, Binding]
    ) -> dict[str, Binding]:
        _check_slugs("binding", bindings)
        return bindings

    @field_validator("dependencies")
    @classmethod
    def _dependencies_are_pinned(cls, dependencies: dict[str, str]) -> dict[str, str]:
        _raise_errors(
            error
            for name, version in dependencies.items()
            if (error := _dependency_error(name, version))
        )
        return dependencies

    @model_validator(mode="after")
    def _references_and_capabilities(self) -> ArtifactManifest:
        _raise_errors(
            [
                *self._event_errors(),
                *self._snapshot_errors(),
                *self._capability_errors(),
            ]
        )
        return self

    def _event_errors(self) -> list[str]:
        errors = []
        for index, event in enumerate(self.events):
            binding = self.bindings.get(event.binding)
            if binding is None:
                errors.append(
                    f"events[{index}] references undeclared binding {event.binding!r}"
                )
            elif event.dimension not in binding.dimensions:
                errors.append(
                    f"events[{index}]: {event.dimension!r} is not a dimension of "
                    f"binding {event.binding!r}"
                )
        return errors

    def _snapshot_errors(self) -> list[str]:
        return [
            f"snapshots[{index}] references undeclared binding {snapshot.binding!r}"
            for index, snapshot in enumerate(self.snapshots)
            if snapshot.binding not in self.bindings
        ]

    def _capability_errors(self) -> list[str]:
        declared = set(self.capabilities)
        needed: dict[Capability, str] = {}
        if self.bindings:
            needed[Capability.DATA] = "bindings"
        for event in self.events:
            if event.kind == "cross_filter":
                needed.setdefault(Capability.CROSS_FILTER, "cross_filter events")
            else:
                needed.setdefault(Capability.EVENTS, f"{event.kind} events")
        return [
            f"{reason} need the {capability.value!r} capability"
            for capability, reason in needed.items()
            if capability not in declared
        ]
