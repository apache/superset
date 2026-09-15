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
non-secret parts.

Fail-closed posture: when the schema cannot say which fields are secret —
the layer's type has no registered provider (extension not loaded), schema
generation fails, or a key is not described by the schema — every scalar
value in the affected subtree is masked rather than exposed.

Every client-facing path that emits a stored configuration must route through
:func:`mask_configuration` — today that is only ``_serialize_layer`` on the two
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
``BaseEngineSpec.unmask_encrypted_extra``), where provider validation
rejects it.
"""

from __future__ import annotations

from typing import Any

from superset.constants import PASSWORD_MASK
from superset.semantic_layers.registry import registry

_UNION_KEYS = ("anyOf", "oneOf", "allOf")

JsonSchema = dict[str, Any]


def _resolve_ref(schema: JsonSchema, defs: dict[str, JsonSchema]) -> JsonSchema:
    """Follow a ``$ref`` into ``$defs`` (one level; refs to refs iterate)."""
    seen: set[str] = set()
    while "$ref" in schema:
        ref_name = schema["$ref"].rsplit("/", 1)[-1]
        if ref_name in seen or ref_name not in defs:
            return {}
        seen.add(ref_name)
        schema = defs[ref_name]
    return schema


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
    if _depth > 16:
        return True  # pathological schema: fail closed
    schema = _resolve_ref(schema, defs)
    if schema.get("format") == "password" or schema.get("writeOnly") is True:
        return True
    return any(
        _is_secret_schema(branch, defs, _depth + 1)
        for key in _UNION_KEYS
        for branch in schema.get(key, [])
        # An object variant is not itself a secret; its own properties are
        # classified field by field when the value is walked.
        if _resolve_ref(branch, defs).get("type") != "object"
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
    first = candidates[0]
    if all(candidate == first for candidate in candidates):
        return first
    if isinstance(item, dict) and all(isinstance(c, dict) for c in candidates):
        keys = set().union(*(c.keys() for c in candidates))
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
    item: Any, schemas: list[JsonSchema], defs: dict[str, JsonSchema]
) -> Any:
    """Mask ``item`` conservatively against every schema it might match."""
    return _combine_masked(
        item, [_mask_value(item, schema, defs) for schema in schemas]
    )


def _object_variants(
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
) -> list[JsonSchema]:
    """The object schemas a value may conform to: itself plus union branches."""
    schema = _resolve_ref(schema, defs)
    variants = [schema]
    for key in _UNION_KEYS:
        variants.extend(_resolve_ref(branch, defs) for branch in schema.get(key, []))
    return [
        variant
        for variant in variants
        if "properties" in variant
        or "additionalProperties" in variant
        or variant.get("type") == "object"
    ]


def _mask_object(
    value: dict[str, Any],
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
) -> dict[str, Any]:
    """Mask a dict value against the object schemas it may conform to."""
    variants = _object_variants(schema, defs)
    if not variants:
        # The schema does not describe this position as an object (e.g. an
        # unresolvable $ref). Reveal it, matching #43474's top-level behavior
        # of masking only fields the schema marks secret; the top-level
        # fail-closed (whole schema unavailable) is handled in
        # ``mask_configuration``.
        return value
    properties: dict[str, list[JsonSchema]] = {}
    for variant in variants:
        for key, sub in variant.get("properties", {}).items():
            properties.setdefault(key, []).append(sub)
    # Free-form keys (not in any variant's ``properties``) are classified by
    # ``additionalProperties``. Mask against EVERY variant's
    # additionalProperties schema, not just the first: when variants declare
    # differing additionalProperties, trusting one branch could reveal a
    # value another branch marks secret. If any variant does not describe
    # such keys with a schema (no dict ``additionalProperties``), the key is
    # unclassifiable there, so fail closed and mask it.
    additional_schemas = [
        variant["additionalProperties"]
        for variant in variants
        if isinstance(variant.get("additionalProperties"), dict)
    ]
    all_variants_classify_extra = all(
        isinstance(variant.get("additionalProperties"), dict) for variant in variants
    )
    masked: dict[str, Any] = {}
    for key, item in value.items():
        subs = properties.get(key)
        if subs is None:
            # A key no variant declares. If every variant constrains extra
            # keys with an ``additionalProperties`` schema, classify against
            # all of them (differing variants must agree to reveal); otherwise
            # the key is schema-undescribed, so reveal it (a nested secret is
            # only masked where the schema marks it, matching #43474).
            masked[key] = (
                _mask_against(item, additional_schemas, defs)
                if additional_schemas and all_variants_classify_extra
                else item
            )
        else:
            # A key may be described by several union variants. Mask against
            # all of them so a secret nested in one variant is never revealed
            # by trusting another (``_is_secret_schema`` does not descend into
            # object ``properties``, so a single-branch check would miss it).
            masked[key] = _mask_against(item, subs, defs)
    return masked


def _mask_list(
    value: list[Any],
    schema: JsonSchema,
    defs: dict[str, JsonSchema],
) -> list[Any]:
    """Mask a list value against its item schema (may sit in a union branch)."""
    resolved = _resolve_ref(schema, defs)
    # ``list[str] | None`` puts the array schema in an anyOf branch;
    # check the schema itself first, then its union branches.
    candidates = [resolved] + [
        _resolve_ref(branch, defs)
        for key in _UNION_KEYS
        for branch in resolved.get(key, [])
    ]
    item_schemas = [
        candidate["items"]
        for candidate in candidates
        if isinstance(candidate.get("items"), dict)
    ]
    if not item_schemas:
        return value
    # Mask each element against every candidate item schema, so an element
    # matching a secret-bearing union branch is masked even when another
    # branch would reveal it.
    return [_mask_against(item, item_schemas, defs) for item in value]


def _mask_value(value: Any, schema: JsonSchema, defs: dict[str, JsonSchema]) -> Any:
    """Mask secrets in ``value`` as classified by ``schema``."""
    if _is_secret_schema(schema, defs):
        # Mask only a truthy secret; an empty/None/0/False value hides
        # nothing and is left as-is (matching the top-level masker in #43474).
        return PASSWORD_MASK if value else value
    if isinstance(value, dict):
        return _mask_object(value, schema, defs)
    if isinstance(value, list):
        return _mask_list(value, schema, defs)
    return value


def mask_configuration(layer_type: str, configuration: Any) -> dict[str, Any]:
    """Return ``configuration`` with all secret material replaced.

    ``layer_type`` selects the registered provider whose published
    configuration schema (``get_configuration_schema``) classifies the
    fields. With no registered provider (or an unusable schema) every
    scalar is masked — a configuration whose secrecy cannot be established
    is never exposed.
    """
    if not configuration or not isinstance(configuration, dict):
        return {}
    cls = registry.get(layer_type)
    if cls is None:
        return _mask_all(configuration)
    try:
        # The connector's own published shape (the same source #43474's
        # top-level masker used); this walker extends it to nested/union
        # secrets rather than only top-level ``writeOnly`` properties.
        schema: JsonSchema = cls.get_configuration_schema()
    except Exception:  # pylint: disable=broad-except
        return _mask_all(configuration)
    if not isinstance(schema, dict):
        return _mask_all(configuration)
    return _mask_value(configuration, schema, schema.get("$defs", {}))


def unmask_configuration(stored: Any, submitted: Any) -> Any:
    """Replace ``PASSWORD_MASK`` sentinels in ``submitted`` from ``stored``.

    Walks both payloads in parallel; a submitted value equal to the mask is
    replaced with the stored value at the same path when one exists, so a
    client can echo a masked read payload back without wiping credentials.
    Any other submitted value — including a genuinely new secret — is kept
    verbatim. Purely sentinel-driven (no schema), so an edit remains safe
    when the provider schema has evolved since the row was stored.

    Two limitations are inherited from the ``Database`` ``encrypted_extra``
    round-trip this mirrors: a client cannot set a field to the literal
    ``PASSWORD_MASK`` string (it reads as an echoed sentinel), and lists are
    matched by index, so reordering a credential list while echoing a mask
    can restore a stored secret to a different position. Neither affects the
    scalar credential shapes in use.
    """
    if isinstance(submitted, dict):
        stored_map = stored if isinstance(stored, dict) else {}
        return {
            key: unmask_configuration(stored_map.get(key), item)
            for key, item in submitted.items()
        }
    if isinstance(submitted, list):
        stored_list = stored if isinstance(stored, list) else []
        return [
            unmask_configuration(
                stored_list[index] if index < len(stored_list) else None,
                item,
            )
            for index, item in enumerate(submitted)
        ]
    if submitted == PASSWORD_MASK and stored is not None:
        return stored
    return submitted
