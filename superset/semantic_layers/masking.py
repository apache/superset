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
"""Masking of secret material in semantic layer configurations.

A semantic layer's ``configuration`` is a credentialed connection payload
(the analogue of a ``Database`` row's ``encrypted_extra``). Provider
configuration schemas mark secret fields with pydantic ``SecretStr``, which
renders in JSON schema as ``{"type": "string", "format": "password",
"writeOnly": true}``. :func:`mask_configuration` walks the registered
provider's schema and replaces the values of those fields with
``PASSWORD_MASK`` before a configuration leaves the server; every other
field passes through untouched so clients can still display and edit the
non-secret parts. Union and pattern-key classifications are conservative:
a secret classification in any branch or key pattern is sufficient to mask
the value, even if another branch or pattern would leave it visible.

Fail closed when no provider is registered, schema generation raises, or
the provider returns a non-dictionary schema. Within a usable schema,
mask fields classified as secret and reveal undescribed fields. An explicit
reference that cannot be resolved masks the affected subtree. Recursive
fallback masking preserves container shape and existing falsy values.

Every client-facing path that emits a stored configuration must route through
:func:`mask_configuration` — ``_serialize_layer`` on the two
GET endpoints. Any future export/import of a semantic layer (there is none yet)
must mask through this same function rather than emitting the raw column.

Masking covers the stored *configuration payload* only. It cannot reach a
schema a provider builds from that payload: ``get_configuration_schema`` and
``get_runtime_schema`` responses are returned to clients verbatim (e.g. the
``runtime_schema`` endpoint), so a provider MUST NOT echo configuration values
— least of all secret ones — back into the schema it returns. Enrichment must
carry only field *shapes* (option lists, defaults for non-secret fields), never
the submitted credential material.

:func:`unmask_configuration` is the write-side counterpart, mirroring the
``Database`` API's ``masked_encrypted_extra`` round-trip: a client may echo
a read payload back on update, so any submitted value equal to
``PASSWORD_MASK`` is replaced with the currently stored value at the same
path. The sentinel swap is schema-independent, which keeps edits safe even
when the provider schema evolved after the row was stored; a mask with no
stored counterpart passes through unchanged (matching
``BaseEngineSpec.unmask_encrypted_extra``). Provider validation may accept
that literal sentinel; it does not recover a credential without a stored value.
"""

from __future__ import annotations

import logging
from typing import Any

from superset_core.semantic_layers.layer import SemanticLayer as CoreSemanticLayer

from superset.constants import PASSWORD_MASK
from superset.semantic_layers.registry import registry

logger: logging.Logger = logging.getLogger(__name__)

_UNION_KEYS: tuple[str, ...] = ("anyOf", "oneOf", "allOf")
_MAX_SCHEMA_DEPTH: int = 16

JsonSchema = dict[str, Any]


class _UnresolvableRefError(Exception):
    """A schema reference or nested classification cannot be resolved safely."""


def _resolve_ref(schema: JsonSchema, defs: dict[str, JsonSchema]) -> JsonSchema:
    """Follow references, retaining every sibling schema's classifications."""
    seen: set[str] = set()
    siblings: list[JsonSchema] = []
    if not isinstance(schema, dict):
        raise _UnresolvableRefError
    while "$ref" in schema:
        if not isinstance(schema["$ref"], str) or not isinstance(defs, dict):
            raise _UnresolvableRefError
        reference: str = schema["$ref"]
        if not reference.startswith("#/$defs/"):
            raise _UnresolvableRefError
        ref_name: str = reference.removeprefix("#/$defs/")
        if not ref_name or "/" in ref_name:
            raise _UnresolvableRefError
        if ref_name in seen or ref_name not in defs:
            raise _UnresolvableRefError
        seen.add(ref_name)
        sibling: JsonSchema = {
            key: item for key, item in schema.items() if key != "$ref"
        }
        if sibling:
            siblings.append(sibling)
        schema = defs[ref_name]
        if not isinstance(schema, dict):
            raise _UnresolvableRefError
    # JSON Schema applies both the referenced target and its sibling keywords.
    # An overlay could discard a secret classification from either side.
    return {"allOf": [schema, *siblings]} if siblings else schema


def _is_secret_schema(
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
    _depth: int = 0,
) -> bool:
    """Whether a field schema denotes secret material (``SecretStr``).

    Union branches (``SecretStr | None``, discriminated unions of scalar
    credential kinds) count as secret when any branch does: a field that
    may hold a secret must always be masked.
    """
    if _depth > _MAX_SCHEMA_DEPTH:
        return True  # pathological schema: fail closed
    schema = _resolve_ref(schema, defs)
    if schema.get("format") == "password" or schema.get("writeOnly") is True:
        return True
    return any(
        _is_secret_schema(branch, defs, _depth + 1)
        for key in _UNION_KEYS
        for branch in schema.get(key, [])
    )


def _mask_all(value: Any) -> Any:
    """Mask every scalar in a subtree the schema cannot vouch for."""
    if isinstance(value, dict):
        return {key: _mask_all(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_mask_all(item) for item in value]
    if value is None:
        return None
    return PASSWORD_MASK if value else value


def _combine_masked(item: Any, candidates: list[Any]) -> Any:
    """Merge the masking results of one value under several candidate schemas.

    A position is revealed only when *every* candidate reveals it identically;
    any divergence keeps it masked. This is what makes union handling
    fail-closed: a secret nested inside a single union branch is masked even
    when a sibling branch would have revealed the same key, so trusting one
    branch can never expose the other's secret.
    """
    first: Any = candidates[0]
    if all(candidate == first for candidate in candidates):
        return first
    if isinstance(item, dict) and all(isinstance(c, dict) for c in candidates):
        keys: set[str] = set().union(*(c.keys() for c in candidates))
        return {
            key: _combine_masked(
                item.get(key), [c[key] for c in candidates if key in c]
            )
            for key in keys
        }
    if isinstance(item, list) and all(isinstance(c, list) for c in candidates):
        return [
            _combine_masked(
                item[index] if index < len(item) else None,
                [c[index] for c in candidates if index < len(c)],
            )
            for index in range(max(len(c) for c in candidates))
        ]
    # Irreconcilable classifications for the same value: fail closed.
    return _mask_all(item)


def _mask_against(
    item: Any,
    schemas: list[JsonSchema],
    defs: dict[str, JsonSchema],
    layer_type: str = "unknown",
) -> Any:
    """Mask ``item`` conservatively against every schema it might match."""
    return _combine_masked(
        item, [_mask_value(item, schema, defs, layer_type) for schema in schemas]
    )


def _flatten_variants(
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
    depth: int = 0,
) -> list[JsonSchema]:
    """Collect classifications through every level of nested union wrappers."""
    if depth > _MAX_SCHEMA_DEPTH:
        raise _UnresolvableRefError
    schema = _resolve_ref(schema, defs)
    variants: list[JsonSchema] = [schema]
    for key in _UNION_KEYS:
        for branch in schema.get(key, []):
            variants.extend(_flatten_variants(branch, defs, depth + 1))
    return variants


def _object_variants(
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
) -> list[JsonSchema]:
    """The object schemas a value may conform to, including nested unions."""
    return [
        variant
        for variant in _flatten_variants(schema, defs)
        if "properties" in variant
        or "patternProperties" in variant
        or "additionalProperties" in variant
        or variant.get("type") == "object"
    ]


def _mask_object(
    value: dict[str, Any],
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
    layer_type: str = "unknown",
) -> dict[str, Any]:
    """Mask a dict value against the object schemas it may conform to."""
    variants: list[JsonSchema] = _object_variants(schema, defs)
    if not variants:
        # A usable schema that does not describe an object leaves it visible.
        # Broken references instead fail closed at the _mask_value boundary.
        return value
    properties: dict[str, list[JsonSchema]] = {}
    for variant in variants:
        for key, sub in variant.get("properties", {}).items():
            properties.setdefault(key, []).append(sub)
    # Free-form keys (not in any variant's ``properties``) are classified by
    # ``additionalProperties``. Mask against EVERY variant's
    # additionalProperties schema, not just the first: when variants declare
    # differing additionalProperties, trusting one branch could reveal a
    # value another branch marks secret. A silent sibling cannot cancel an
    # explicit secret classification.
    additional_schemas: list[JsonSchema] = [
        variant["additionalProperties"]
        for variant in variants
        if isinstance(variant.get("additionalProperties"), dict)
    ]
    # Apply every pattern classification conservatively, without relying on
    # Python regular expressions to implement JSON Schema's regex dialect.
    pattern_schemas: list[JsonSchema] = [
        sub
        for variant in variants
        for sub in variant.get("patternProperties", {}).values()
    ]
    masked: dict[str, Any] = {}
    for key, item in value.items():
        subs: list[JsonSchema] | None = properties.get(key)
        if subs is None:
            # Classify extras against every available schema. Without any
            # additional-properties schema, retain reveal-unless-marked behavior.
            masked[key] = (
                _mask_against(
                    item, additional_schemas + pattern_schemas, defs, layer_type
                )
                if additional_schemas or pattern_schemas
                else item
            )
        else:
            # A key may be described by several union variants. Mask against
            # all of them so a secret nested in one variant is never revealed
            # by trusting another (``_is_secret_schema`` does not descend into
            # object ``properties``, so a single-branch check would miss it).
            extra_schemas: list[JsonSchema] = [
                variant["additionalProperties"]
                for variant in variants
                if key not in variant.get("properties", {})
                and isinstance(variant.get("additionalProperties"), dict)
            ]
            masked[key] = _mask_against(
                item, subs + extra_schemas + pattern_schemas, defs, layer_type
            )
    return masked


def _mask_list(
    value: list[Any],
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
    layer_type: str = "unknown",
) -> list[Any]:
    """Mask a list value against its item schema (may sit in a union branch)."""
    candidates: list[JsonSchema] = _flatten_variants(schema, defs)
    masked: list[Any] = []
    for index, item in enumerate(value):
        item_schemas: list[JsonSchema] = []
        for candidate in candidates:
            prefix: list[JsonSchema] = candidate.get("prefixItems", [])
            if not isinstance(prefix, list):
                raise _UnresolvableRefError
            if index < len(prefix):
                item_schemas.append(prefix[index])
            elif isinstance(candidate.get("items"), dict):
                item_schemas.append(candidate["items"])
        # Positional tuple schemas apply before the schema for remaining items.
        # All matching variants must agree before an element can be revealed.
        masked.append(
            _mask_against(item, item_schemas, defs, layer_type)
            if item_schemas
            else item
        )
    return masked


def _mask_value(
    value: Any,
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
    layer_type: str = "unknown",
) -> Any:
    """Mask secrets in ``value`` as classified by ``schema``."""
    try:
        if _is_secret_schema(schema, defs):
            # Mask only a truthy secret; an empty/None/0/False value hides
            # nothing and is left as-is (matching the top-level masker in #43474).
            return PASSWORD_MASK if value else value
        if isinstance(value, dict):
            return _mask_object(value, schema, defs, layer_type)
        if isinstance(value, list):
            return _mask_list(value, schema, defs, layer_type)
        return value
    except (_UnresolvableRefError, TypeError, AttributeError) as ex:
        logger.warning(
            "Masking semantic layer type %s subtree: "
            "malformed or unresolved schema (%s)",
            layer_type,
            type(ex).__name__,
        )
        return _mask_all(value)


def mask_configuration(layer_type: str, configuration: Any) -> dict[str, Any]:
    """Return ``configuration`` with all secret material replaced.

    ``layer_type`` selects the registered provider whose published
    configuration schema (``get_configuration_schema``) classifies the
    fields. With no registered provider, a raising schema call, or a
    non-dictionary schema, every scalar is masked. Within a usable schema,
    only fields it marks secret are masked.
    """
    if not configuration or not isinstance(configuration, dict):
        return {}
    cls: type[CoreSemanticLayer[Any, Any]] | None = registry.get(layer_type)
    if cls is None:
        logger.warning(
            "Masking semantic layer type %s: provider not registered", layer_type
        )
        return _mask_all(configuration)
    try:
        # The connector's own published shape (the same source #43474's
        # top-level masker used); this walker extends it to nested/union
        # secrets rather than only top-level ``writeOnly`` properties.
        schema: JsonSchema = cls.get_configuration_schema()
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Masking semantic layer type %s: schema generation failed", layer_type
        )
        return _mask_all(configuration)
    if not isinstance(schema, dict):
        logger.warning(
            "Masking semantic layer type %s: non-dictionary schema", layer_type
        )
        return _mask_all(configuration)
    masked: Any = _mask_value(
        configuration, schema, schema.get("$defs", {}), layer_type
    )
    # A root-level secret marker must not change the API's configuration shape.
    return masked if isinstance(masked, dict) else _mask_all(configuration)


def _contains_mask(value: Any) -> bool:
    """Identify a sentinel anywhere in a submitted JSON subtree."""
    if isinstance(value, dict):
        return any(_contains_mask(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_mask(item) for item in value)
    return value == PASSWORD_MASK


def _matches_visible_values(reference: Any, submitted: Any) -> bool:
    """Compare clear values without treating a guessed field as a stable key."""
    if reference == PASSWORD_MASK or submitted == PASSWORD_MASK:
        return True
    if isinstance(submitted, dict):
        return (
            isinstance(reference, dict)
            and reference.keys() == submitted.keys()
            and all(
                _matches_visible_values(reference[key], item)
                for key, item in submitted.items()
            )
        )
    if isinstance(submitted, list):
        return (
            isinstance(reference, list)
            and len(reference) == len(submitted)
            and all(
                _matches_visible_values(old, new)
                for old, new in zip(reference, submitted, strict=True)
            )
        )
    return type(reference) is type(submitted) and reference == submitted


class MaskedListUpdateError(Exception):
    """A masked list edit cannot preserve positional credential ownership."""


def unmask_configuration(
    stored: Any, submitted: Any, masked_reference: Any = None
) -> Any:
    """Restore sentinels while checking list positions against GET-visible values.

    The caller supplies the masked stored configuration as the identity reference.
    Without a schema reference, all stored values are treated as secret wildcards.
    An all-masked reference disables reorder detection: list credentials restore
    positionally even when a caller changes fields hidden by schema fallback.
    Masked lists must retain length and visible values at each position, including
    when appending explicit entries. Indistinguishable echoes restore positionally.
    Fully explicit lists may be replaced or reordered. Literal PASSWORD_MASK is
    reserved for echoed credentials; explicit secret replacements are never compared
    to stored secrets and remain subject to normal provider validation.
    """
    if masked_reference is None:
        masked_reference = _mask_all(stored)
    if isinstance(submitted, dict):
        stored_map: dict[str, Any] = stored if isinstance(stored, dict) else {}
        reference_map: dict[str, Any] = (
            masked_reference if isinstance(masked_reference, dict) else {}
        )
        return {
            key: unmask_configuration(
                stored_map.get(key), item, reference_map.get(key, PASSWORD_MASK)
            )
            for key, item in submitted.items()
        }
    if isinstance(submitted, list):
        stored_list: list[Any] = stored if isinstance(stored, list) else []
        reference_list: list[Any] = (
            masked_reference
            if isinstance(masked_reference, list)
            else [PASSWORD_MASK] * len(stored_list)
        )
        if _contains_mask(submitted):
            if len(stored_list) != len(submitted):
                raise MaskedListUpdateError(
                    "Masked list length cannot change. "
                    "Submit explicit credentials to replace the list."
                )
            if any(
                _contains_mask(item)
                and index < len(reference_list)
                and not _matches_visible_values(reference_list[index], item)
                for index, item in enumerate(submitted)
            ):
                raise MaskedListUpdateError(
                    "Masked list order or visible fields cannot change. "
                    "Submit explicit credentials to replace or reorder the list."
                )
        return [
            unmask_configuration(
                stored_list[index] if index < len(stored_list) else None,
                item,
                reference_list[index] if index < len(reference_list) else PASSWORD_MASK,
            )
            for index, item in enumerate(submitted)
        ]
    if submitted == PASSWORD_MASK and stored is not None:
        return stored
    return submitted
