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
"""Unit tests for semantic layer configuration masking."""

from __future__ import annotations

from copy import deepcopy
from typing import Annotated, Any, Literal, Union
from unittest.mock import patch

import pytest
from pydantic import BaseModel, Field, SecretStr, StringConstraints
from pytest_mock import MockerFixture

from superset.constants import PASSWORD_MASK
from superset.semantic_layers import masking
from superset.semantic_layers.masking import (
    _is_secret_schema,
    _mask_all,
    _mask_object,
    mask_configuration,
    MaskedListUpdateError,
    unmask_configuration,
)


class KeyAuth(BaseModel):
    kind: Literal["key"] = "key"
    private_key: SecretStr
    passphrase: SecretStr | None = None


class PasswordAuth(BaseModel):
    kind: Literal["password"] = "password"
    password: SecretStr


class DemoConfig(BaseModel):
    account: str
    auth: Annotated[Union[KeyAuth, PasswordAuth], Field(discriminator="kind")]
    token: SecretStr | None = None
    warehouses: list[str] | None = None


class DemoLayerType:
    @staticmethod
    def get_configuration_schema(configuration: Any = None) -> Any:
        return DemoConfig.model_json_schema()


def _register(type_name: str = "demo") -> Any:
    return patch.dict(
        "superset.semantic_layers.registry.registry",
        {type_name: DemoLayerType},
    )


def test_mask_replaces_secret_fields_and_keeps_plain_ones() -> None:
    """SecretStr fields mask; non-secret fields pass through untouched."""
    config: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "password", "password": "hunter2"},
        "token": "tok-123",
        "warehouses": ["small", "large"],
    }
    with _register():
        masked: dict[str, Any] = mask_configuration("demo", config)
    assert masked == {
        "account": "acme",
        "auth": {"kind": "password", "password": PASSWORD_MASK},
        "token": PASSWORD_MASK,
        "warehouses": ["small", "large"],
    }


def test_mask_covers_every_union_variant() -> None:
    """Secrets in a discriminated-union variant mask, incl. optional ones."""
    config: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": "pp"},
    }
    with _register():
        masked: dict[str, Any] = mask_configuration("demo", config)
    assert masked["auth"] == {
        "kind": "key",
        "private_key": PASSWORD_MASK,
        "passphrase": PASSWORD_MASK,
    }


def test_mask_leaves_null_secrets_null() -> None:
    """A secret that is not set stays visibly unset, not masked."""
    config: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": None},
        "token": None,
    }
    with _register():
        masked: dict[str, Any] = mask_configuration("demo", config)
    assert masked["token"] is None
    assert masked["auth"]["passphrase"] is None


def test_mask_fails_closed_without_a_registered_provider() -> None:
    """No registered schema: every scalar masks (nothing can be vouched for)."""
    config: dict[str, Any] = {
        "account": "acme",
        "nested": {"password": "x", "port": 443},
    }
    masked: dict[str, Any] = mask_configuration("unknown-type", config)
    assert masked == {
        "account": PASSWORD_MASK,
        "nested": {"password": PASSWORD_MASK, "port": PASSWORD_MASK},
    }


def test_reveals_keys_the_schema_does_not_describe_but_masks_marked_secrets() -> None:
    """A key no schema property describes is revealed (matching #43474); a
    field the schema marks secret is still masked even alongside it."""
    config: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "password", "password": "x"},
        "legacy_field": "kept",
    }
    with _register():
        masked: dict[str, Any] = mask_configuration("demo", config)
    assert masked["legacy_field"] == "kept"  # undescribed -> revealed
    assert masked["account"] == "acme"
    assert masked["auth"]["password"] == PASSWORD_MASK  # nested secret -> masked


def test_mask_empty_or_non_dict_configuration_is_empty() -> None:
    assert mask_configuration("demo", None) == {}
    assert mask_configuration("demo", {}) == {}
    assert mask_configuration("demo", "not-a-dict") == {}


def test_mask_object_reveals_a_dict_the_schema_does_not_type_as_an_object() -> None:
    """A usable schema typing this position as a scalar yields no object
    variants, so the dict is revealed rather than masked.

    An unresolvable ``$ref`` used to arrive here too, via ``_resolve_ref``
    returning ``{}``; it now raises and fails closed at the ``_mask_value``
    boundary instead, leaving this branch for genuinely undescribed objects.
    """
    value: dict[str, Any] = {"nested": "kept"}
    assert _mask_object(value, {"type": "string"}, {}) == value


def test_mask_all_masks_scalars_recursively() -> None:
    assert _mask_all({"a": 1, "b": [None, "x", {"c": True}]}) == {
        "a": PASSWORD_MASK,
        "b": [None, PASSWORD_MASK, {"c": PASSWORD_MASK}],
    }


def test_mask_covers_a_secret_nested_in_only_one_union_variant() -> None:
    """A secret hidden in a single union branch must not be revealed by a
    sibling branch that shares the key name (fail-closed union handling)."""

    class PlainConn(BaseModel):
        kind: Literal["plain"] = "plain"
        conn: "PlainDetails"

    class SecretConn(BaseModel):
        kind: Literal["secret"] = "secret"
        conn: "SecretDetails"

    class PlainDetails(BaseModel):
        host: str
        # Same key name as SecretDetails.password, but a PLAIN string here:
        # trusting this (non-secret) branch is exactly what would leak the
        # sibling variant's secret.
        password: str

    class SecretDetails(BaseModel):
        host: str
        password: SecretStr

    class DivergentConfig(BaseModel):
        endpoint: Annotated[Union[PlainConn, SecretConn], Field(discriminator="kind")]

    PlainConn.model_rebuild()
    SecretConn.model_rebuild()

    class DivergentType:
        @staticmethod
        def get_configuration_schema(configuration: Any = None) -> Any:
            return DivergentConfig.model_json_schema()

    value: dict[str, Any] = {
        "endpoint": {"kind": "secret", "conn": {"host": "h", "password": "s3"}}
    }
    with patch.dict(
        "superset.semantic_layers.registry.registry", {"divergent": DivergentType}
    ):
        masked: dict[str, Any] = mask_configuration("divergent", value)
    # host stays visible in both variants; the password (present only in the
    # secret variant) must be masked, not passed through via the plain branch.
    assert masked["endpoint"]["conn"]["host"] == "h"
    assert masked["endpoint"]["conn"]["password"] == PASSWORD_MASK


def test_unmask_swaps_sentinels_from_the_stored_configuration() -> None:
    """Echoed masks restore stored secrets; edited fields keep new values."""
    stored: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "password", "password": "hunter2"},
        "token": "tok-123",
    }
    submitted: dict[str, Any] = {
        "account": "acme-renamed",  # edited plain field
        "auth": {"kind": "password", "password": PASSWORD_MASK},  # echoed
        "token": "tok-456",  # retyped secret
    }
    assert unmask_configuration(stored, submitted) == {
        "account": "acme-renamed",
        "auth": {"kind": "password", "password": "hunter2"},
        "token": "tok-456",
    }


def test_unmask_passes_an_orphan_mask_through() -> None:
    """A mask with no stored counterpart remains the submitted literal sentinel."""
    submitted: dict[str, Any] = {
        "auth": {"kind": "password", "password": PASSWORD_MASK}
    }
    assert unmask_configuration({}, submitted) == submitted


def test_unmask_rejects_masked_list_length_changes() -> None:
    """Adding entries cannot silently relocate an existing secret."""
    with pytest.raises(MaskedListUpdateError, match="Masked list length"):
        unmask_configuration(["k1", "k2"], [PASSWORD_MASK, "new-k2", PASSWORD_MASK])


@pytest.mark.parametrize("mode", ["reordered", "removed", "edited"])
def test_unmask_rejects_unsafe_masked_lists(mode: str) -> None:
    """Visible entries must identify the same single stored item at its index."""
    stored: list[dict[str, str]] = [
        {"host": "a", "password": "secret-a"},
        {"host": "b", "password": "secret-b"},
    ]
    submitted: list[dict[str, str]] = [
        {"host": "a", "password": PASSWORD_MASK},
        {"host": "b", "password": PASSWORD_MASK},
    ]
    reference: list[dict[str, str]] = deepcopy(submitted)
    if mode == "reordered":
        submitted.reverse()
    elif mode == "removed":
        submitted.pop()
    else:
        submitted[0]["host"] = "new-host"
    with pytest.raises(MaskedListUpdateError, match="Submit explicit credentials"):
        unmask_configuration(stored, submitted, reference)


def test_unmask_preserves_identifiable_list_and_accepts_explicit_replacement() -> None:
    """Safe echoes and explicit replacements remain available without guessed keys."""
    stored: list[dict[str, Any]] = [
        {"host": "a", "auth": {"password": "secret-a"}},
        {"host": "b", "auth": {"password": "secret-b"}},
    ]
    submitted: list[dict[str, Any]] = [
        {"host": "a", "auth": {"password": PASSWORD_MASK}},
        {"host": "b", "auth": {"password": PASSWORD_MASK}},
    ]
    assert unmask_configuration(stored, submitted) == stored
    assert unmask_configuration(stored, list(reversed(stored))) == list(
        reversed(stored)
    )
    assert unmask_configuration(["only-secret"], [PASSWORD_MASK]) == ["only-secret"]
    assert unmask_configuration(["a", "b"], [PASSWORD_MASK, PASSWORD_MASK]) == [
        "a",
        "b",
    ]


def test_malformed_schema_warning_never_includes_values(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Schema failure diagnostics contain no provider input or traceback."""
    assert masking._mask_value(
        {"password": "CONFIG-SECRET"}, {"anyOf": 4}, {}, "test-provider"
    ) == {"password": PASSWORD_MASK}
    assert "test-provider" in caplog.text
    assert "malformed or unresolved schema" in caplog.text
    assert "TypeError" in caplog.text
    assert "CONFIG-SECRET" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


def test_mask_then_unmask_round_trips_to_the_stored_configuration() -> None:
    """An untouched echo of a masked read must reproduce the stored config."""
    stored: dict[str, Any] = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": "pp"},
        "token": "tok-123",
        "warehouses": ["small"],
    }
    with _register():
        echoed: dict[str, Any] = mask_configuration("demo", stored)
    assert unmask_configuration(stored, echoed) == stored


class _FakeProvider:
    """A provider stand-in whose get_configuration_schema is caller-controlled."""

    def __init__(self, schema: Any = None, raises: bool = False) -> None:
        self._schema: Any = schema
        self._raises: bool = raises

    def get_configuration_schema(self, configuration: Any = None) -> Any:
        if self._raises:
            raise RuntimeError("schema generation failed")
        return self._schema


def _with_schema(schema: Any) -> Any:
    return patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": _FakeProvider(schema)},
    )


def test_unresolvable_ref_masks_its_subtree() -> None:
    """A failed explicit reference masks its subtree, not unrelated fields."""
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {"conn": {"$ref": "#/$defs/Missing"}},
        "$defs": {},
    }
    with _with_schema(schema):
        masked: dict[str, Any] = mask_configuration("fake", {"conn": {"host": "h"}})
    assert masked["conn"] == {"host": PASSWORD_MASK}


def test_untyped_array_is_revealed() -> None:
    """A list field whose schema declares no item type carries no marked
    secret, so it is revealed (matching #43474's reveal-unless-marked rule)."""
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {"tags": {"type": "array"}},
        "$defs": {},
    }
    with _with_schema(schema):
        masked: dict[str, Any] = mask_configuration("fake", {"tags": ["a", "b"]})
    assert masked["tags"] == ["a", "b"]


def test_mask_fails_closed_when_schema_generation_raises() -> None:
    """If the provider's get_configuration_schema raises, mask everything."""
    with patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": _FakeProvider(raises=True)},
    ):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"account": "acme", "password": "x"}
        )
    assert masked == {"account": PASSWORD_MASK, "password": PASSWORD_MASK}


def test_is_secret_schema_fails_closed_on_pathological_depth() -> None:
    """A schema nested past the recursion guard is treated as secret."""
    schema: Any = {"type": "string"}
    for _ in range(20):
        schema = {"anyOf": [schema]}
    assert _is_secret_schema(schema, {}) is True


def test_mask_covers_a_secret_list_in_only_one_union_variant() -> None:
    """A list that is a secret in any matching union variant is masked.

    Exercises the conservative element-wise combine across divergent list
    candidates: the same key is ``list[str]`` in one variant and
    ``list[SecretStr]`` in another.
    """

    class ListPlain(BaseModel):
        kind: Literal["plain"] = "plain"
        items: list[str] | None = None

    class ListSecret(BaseModel):
        kind: Literal["secret"] = "secret"
        items: list[SecretStr] | None = None

    class DivergentListConfig(BaseModel):
        conn: Annotated[Union[ListPlain, ListSecret], Field(discriminator="kind")]

    class DivergentListType:
        @staticmethod
        def get_configuration_schema(configuration: Any = None) -> Any:
            return DivergentListConfig.model_json_schema()

    value: dict[str, Any] = {"conn": {"kind": "plain", "items": ["x", "y"]}}
    with patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": DivergentListType},
    ):
        masked: dict[str, Any] = mask_configuration("fake", value)
    # The list is a secret in the ListSecret variant, so it masks even though
    # the discriminator selects the plain variant.
    assert masked["conn"]["items"] == [PASSWORD_MASK, PASSWORD_MASK]


def test_non_dict_schema_masks_all() -> None:
    """A provider whose get_configuration_schema returns a non-dict cannot
    classify anything, so the whole configuration is masked (fail closed)."""
    with patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": _FakeProvider(schema=None)},
    ):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"account": "acme", "password": "x"}
        )
    assert masked == {"account": PASSWORD_MASK, "password": PASSWORD_MASK}


def test_additionalproperties_divergent_union_variants_mask_conservatively() -> None:
    """A free-form key is masked when any union variant's additionalProperties
    marks it secret, even if an *earlier* variant would reveal it.

    Guards Amin's Finding 1: the object masker must classify free-form keys
    against every variant's additionalProperties, not just the first. Here the
    first (plain) variant would reveal the key; the second (secret) variant
    must still force a mask.
    """
    schema: dict[str, Any] = {
        "oneOf": [
            {
                "type": "object",
                "properties": {"kind": {"const": "plain"}},
                "additionalProperties": {"type": "string"},
            },
            {
                "type": "object",
                "properties": {"kind": {"const": "secret"}},
                "additionalProperties": {"writeOnly": True},
            },
        ],
        "$defs": {},
    }
    with _with_schema(schema):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"kind": "plain", "extra": "sensitive"}
        )
    assert masked["kind"] == "plain"
    assert masked["extra"] == PASSWORD_MASK


@pytest.mark.parametrize("union", ["anyOf", "oneOf", "allOf"])
@pytest.mark.parametrize("reverse", [False, True])
def test_silent_union_sibling_cannot_reveal_secret_extras(
    union: str, reverse: bool
) -> None:
    """A silent branch cannot override another branch's secret annotation."""
    variants: list[dict[str, Any]] = [
        {"properties": {"host": {"type": "string"}}},
        {
            "properties": {"host": {"type": "string"}},
            "additionalProperties": {"writeOnly": True},
        },
    ]
    if reverse:
        variants.reverse()
    with _with_schema({union: variants}):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"host": "h", "extra": "credential"}
        )
    assert masked == {"host": "h", "extra": PASSWORD_MASK}


def test_silent_union_without_secret_annotations_reveals_extras() -> None:
    """Silence alone does not classify additional properties as secrets."""
    with _with_schema({"anyOf": [{"type": "object"}, {"type": "object"}]}):
        masked: dict[str, Any] = mask_configuration("fake", {"extra": "plain"})
    assert masked == {"extra": "plain"}


@pytest.mark.parametrize("cyclic", [False, True])
@pytest.mark.parametrize("in_union", [False, True])
@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("secret", PASSWORD_MASK),
        ({"secret": "s", "empty": ""}, {"secret": PASSWORD_MASK, "empty": ""}),
        (
            ["s", {"secret": "s"}, None, False, 0],
            [PASSWORD_MASK, {"secret": PASSWORD_MASK}, None, False, 0],
        ),
    ],
)
def test_broken_references_mask_only_the_affected_value(
    cyclic: bool, in_union: bool, value: Any, expected: Any
) -> None:
    """Missing and cyclic references fail closed across value shapes."""
    reference: dict[str, Any] = {"$ref": "#/$defs/A"}
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "plain": {"type": "string"},
            "secret": {"anyOf": [reference, {"type": "null"}]}
            if in_union
            else reference,
        },
        "$defs": {"A": {"$ref": "#/$defs/B"}, "B": {"$ref": "#/$defs/A"}}
        if cyclic
        else {},
    }
    with _with_schema(schema):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"plain": "visible", "secret": value}
        )
    assert masked == {"plain": "visible", "secret": expected}


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        ("missing", "provider not registered"),
        ("raising", "schema generation failed"),
        ("invalid", "non-dictionary schema"),
    ],
)
def test_schema_fallback_warns_without_logging_credentials(
    failure: str, reason: str, caplog: pytest.LogCaptureFixture
) -> None:
    """Warn with a safe reason while keeping fallback payloads masked."""
    config: dict[str, Any] = {"nested": {"password": "PAYLOAD-CREDENTIAL"}}
    with (
        patch.dict(masking.registry, {"fake": _FakeProvider(None)}, clear=True),
        patch.object(
            _FakeProvider,
            "get_configuration_schema",
            side_effect=RuntimeError("EXCEPTION-CREDENTIAL")
            if failure == "raising"
            else None,
            return_value=None,
        ),
        caplog.at_level("WARNING", logger=masking.__name__),
    ):
        layer_type: str = "absent" if failure == "missing" else "fake"
        masked: dict[str, Any] = mask_configuration(layer_type, config)
    assert masked == {"nested": {"password": PASSWORD_MASK}}
    messages: list[str] = [
        record.getMessage()
        for record in caplog.records
        if record.name == masking.__name__
    ]
    assert len(messages) == 1
    assert layer_type in messages[0]
    assert reason in messages[0]
    assert "PAYLOAD-CREDENTIAL" not in caplog.text
    assert "EXCEPTION-CREDENTIAL" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


def test_valid_secret_schema_does_not_warn(caplog: pytest.LogCaptureFixture) -> None:
    """Ordinary secret masking is not reported as a schema failure."""
    with _with_schema({"additionalProperties": {"writeOnly": True}}):
        masked: dict[str, Any] = mask_configuration("fake", {"password": "s"})
    assert masked == {"password": PASSWORD_MASK}
    assert not caplog.records


@pytest.mark.parametrize("union", ["anyOf", "oneOf", "allOf"])
@pytest.mark.parametrize("reverse", [False, True])
def test_declared_property_honors_sibling_secret_extras(
    union: str, reverse: bool
) -> None:
    """A declared plain property cannot override a sibling's secret map schema."""
    variants: list[dict[str, Any]] = [
        {"type": "object", "properties": {"token": {"type": "string"}}},
        {"type": "object", "additionalProperties": {"writeOnly": True}},
    ]
    if reverse:
        variants.reverse()
    with _with_schema({"properties": {"conn": {union: variants}}}):
        masked: dict[str, Any] = mask_configuration(
            "fake", {"conn": {"token": "synthetic-secret"}}
        )
    assert masked["conn"]["token"] == PASSWORD_MASK


@pytest.mark.parametrize("position", ["property", "list", "map"])
def test_optional_discriminated_union_masks_nested_secrets(position: str) -> None:
    class OptionalAuth(BaseModel):
        auth: (
            Annotated[Union[KeyAuth, PasswordAuth], Field(discriminator="kind")] | None
        ) = None

    schema: dict[str, Any] = OptionalAuth.model_json_schema()
    auth: dict[str, Any] = {"kind": "password", "password": "synthetic-secret"}
    expected: dict[str, Any] = {"kind": "password", "password": PASSWORD_MASK}
    value: Any = auth
    result: Any = expected
    if position == "list":
        schema["properties"]["auth"] = {"items": schema["properties"]["auth"]}
        value, result = [auth], [expected]
    elif position == "map":
        schema["properties"]["auth"] = {
            "additionalProperties": schema["properties"]["auth"]
        }
        value, result = {"primary": auth}, {"primary": expected}
    with _with_schema(schema):
        assert mask_configuration("fake", {"auth": value}) == {"auth": result}


def test_nested_union_array_masks_secret_items() -> None:
    schema: dict[str, Any] = {
        "properties": {
            "tokens": {"anyOf": [{"oneOf": [{"items": {"writeOnly": True}}]}]}
        }
    }
    with _with_schema(schema):
        assert mask_configuration("fake", {"tokens": ["secret"]}) == {
            "tokens": [PASSWORD_MASK]
        }


@pytest.mark.parametrize("marker", [{"writeOnly": True}, {"format": "password"}])
@pytest.mark.parametrize("nested", [False, True])
def test_reference_sibling_secret_marker_is_preserved(
    marker: dict[str, Any], nested: bool
) -> None:
    schema: dict[str, Any] = {
        "$defs": {"Credentials": {"properties": {"blob": {"type": "string"}}}},
        "properties": {"creds": {"$ref": "#/$defs/Credentials", **marker}},
    }
    value: dict[str, Any] = {"creds": {"blob": "secret"}}
    expected: dict[str, Any] = {"creds": PASSWORD_MASK}
    if nested:
        schema["properties"] = {"nested": {"properties": schema["properties"]}}
        value, expected = {"nested": value}, {"nested": expected}
    with _with_schema(schema):
        assert mask_configuration("fake", value) == expected


@pytest.mark.parametrize("union", [None, "anyOf", "oneOf", "allOf"])
def test_secret_object_marker_survives_union(union: str | None) -> None:
    reference: dict[str, Any] = {"$ref": "#/$defs/SecretObject"}
    schema: dict[str, Any] = {
        "$defs": {
            "SecretObject": {
                "type": "object",
                "writeOnly": True,
                "properties": {"blob": {"type": "string"}},
            }
        },
        "properties": {"creds": {union: [reference]} if union else reference},
    }
    with _with_schema(schema):
        assert mask_configuration("fake", {"creds": {"blob": "secret"}}) == {
            "creds": PASSWORD_MASK
        }


@pytest.mark.parametrize("subschema", [True, False, {"anyOf": [True]}])
def test_unsupported_subschema_masks_only_affected_value(subschema: Any) -> None:
    schema: dict[str, Any] = {"properties": {"creds": subschema}}
    with _with_schema(schema):
        assert mask_configuration("fake", {"creds": "secret", "plain": "visible"}) == {
            "creds": PASSWORD_MASK,
            "plain": "visible",
        }


@pytest.mark.parametrize("optional", [False, True])
def test_tuple_secret_uses_positional_schema(optional: bool) -> None:
    class TupleConfig(BaseModel):
        pair: tuple[str, SecretStr]
        optional_pair: tuple[str, SecretStr] | None = None

    key: str = "optional_pair" if optional else "pair"
    with _with_schema(TupleConfig.model_json_schema()):
        assert mask_configuration("fake", {key: ["visible", "secret"]}) == {
            key: ["visible", PASSWORD_MASK]
        }


def test_pattern_keyed_map_masks_marked_values() -> None:
    class PatternConfig(BaseModel):
        credentials: dict[Annotated[str, StringConstraints(pattern="^k_")], SecretStr]

    with _with_schema(PatternConfig.model_json_schema()):
        assert mask_configuration("fake", {"credentials": {"k_a": "secret"}}) == {
            "credentials": {"k_a": PASSWORD_MASK}
        }


@pytest.mark.parametrize("schema", [{"anyOf": None}, {"properties": True}])
def test_malformed_keyword_container_masks_affected_subtree(
    schema: dict[str, Any],
) -> None:
    with _with_schema({"properties": {"creds": schema}}):
        assert mask_configuration(
            "fake", {"creds": {"token": "secret"}, "plain": "visible"}
        ) == {"creds": {"token": PASSWORD_MASK}, "plain": "visible"}


@pytest.mark.parametrize("marker", [{"writeOnly": True}, {"format": "password"}])
def test_root_secret_preserves_configuration_mapping(marker: dict[str, Any]) -> None:
    with _with_schema(marker):
        assert mask_configuration("fake", {"token": "secret"}) == {
            "token": PASSWORD_MASK
        }


@pytest.mark.parametrize(
    ("schema", "value", "expected"),
    [
        (
            {"prefixItems": {"0": {"writeOnly": True}}},
            ["first", "second"],
            [PASSWORD_MASK, PASSWORD_MASK],
        ),
        (
            {"prefixItems": [{"type": "string"}], "items": {"format": "password"}},
            ["visible", "first", "second"],
            ["visible", PASSWORD_MASK, PASSWORD_MASK],
        ),
        (
            {
                "properties": {"host": {"type": "string"}},
                "patternProperties": {"^token": {"writeOnly": True}},
            },
            {"host": "conservatively-masked"},
            {"host": PASSWORD_MASK},
        ),
    ],
)
def test_positional_and_pattern_schema_boundaries(
    schema: dict[str, Any], value: Any, expected: Any
) -> None:
    """Malformed prefixes fail closed; prefix tails and pattern siblings classify."""
    with _with_schema({"properties": {"value": schema}}):
        assert mask_configuration("fake", {"value": value}) == {"value": expected}


@pytest.mark.parametrize(
    "field_schema, definitions",
    [
        ({"$ref": 123}, {}),
        ({"$ref": "#/$defs/"}, {"": {}}),
        ({"$ref": "#/$defs/A/properties/token"}, {"token": {"type": "string"}}),
        ({"$ref": "https://provider.example/schema/token"}, {"token": {}}),
        ({"$ref": "#/definitions/token"}, {"token": {}}),
        ({"$ref": "#/$defs/Credentials"}, {"Credentials": None}),
    ],
)
def test_invalid_reference_shape_masks_only_affected_subtree(
    field_schema: dict[str, Any], definitions: dict[str, Any]
) -> None:
    """Malformed references cannot reveal values or hide unrelated plain fields."""
    schema: dict[str, Any] = {
        "properties": {"credentials": field_schema},
        "$defs": definitions,
    }
    with _with_schema(schema):
        assert mask_configuration(
            "fake",
            {"credentials": {"token": "secret"}, "plain": "visible"},
        ) == {"credentials": {"token": PASSWORD_MASK}, "plain": "visible"}


def test_flatten_variants_rejects_excessive_union_nesting() -> None:
    """The variant walker refuses schemas beyond its bounded recursion limit."""
    schema: dict[str, Any] = {"type": "object"}
    _: int
    for _ in range(17):
        schema = {"anyOf": [schema]}
    with pytest.raises(masking._UnresolvableRefError):
        masking._flatten_variants(schema, {})
    with _with_schema(schema):
        assert mask_configuration("fake", {"token": "secret"}) == {
            "token": PASSWORD_MASK
        }


@pytest.mark.parametrize("mode", ["echo", "length", "value", "type"])
def test_masked_entry_nested_list_identity(mode: str) -> None:
    """Nested visible lists affect identity; masked values never do."""
    stored: list[dict[str, Any]] = [{"tags": ["a", "b"], "password": "secret"}]
    reference: list[dict[str, Any]] = [{"tags": ["a", "b"], "password": PASSWORD_MASK}]
    submitted: list[dict[str, Any]] = deepcopy(reference)
    if mode == "length":
        submitted[0]["tags"].append("c")
    elif mode == "value":
        submitted[0]["tags"][0] = "c"
    elif mode == "type":
        submitted[0]["tags"] = {"0": "a"}
    if mode == "echo":
        assert unmask_configuration(stored, submitted, reference) == stored
    else:
        with pytest.raises(MaskedListUpdateError):
            unmask_configuration(stored, submitted, reference)


def test_whole_secret_list_reference_is_wildcard() -> None:
    """A whole-array or whole-object secret marker does not compare private values."""
    assert unmask_configuration(
        [{"password": "secret", "pin": "1234"}],
        [{"password": PASSWORD_MASK, "pin": "wrong"}],
        PASSWORD_MASK,
    ) == [{"password": "secret", "pin": "wrong"}]
    assert unmask_configuration(
        [{"x": "secret"}], [{"x": PASSWORD_MASK}], [PASSWORD_MASK]
    ) == [{"x": "secret"}]


@pytest.mark.parametrize(
    "visible, changed", [(1, True), (True, 1), (0, False), (1, 1.0)]
)
def test_masked_list_identity_rejects_equal_values_of_different_types(
    visible: int | bool | float, changed: int | bool | float
) -> None:
    """Python equality must not rebind credentials to a different JSON identity."""
    stored: list[dict[str, Any]] = [{"identity": visible, "password": "secret"}]
    reference: list[dict[str, Any]] = [{"identity": visible, "password": PASSWORD_MASK}]
    submitted: list[dict[str, Any]] = [{"identity": changed, "password": PASSWORD_MASK}]
    with pytest.raises(MaskedListUpdateError, match="visible fields cannot change"):
        unmask_configuration(stored, submitted, reference)


def test_short_masked_list_reference_uses_secret_wildcard() -> None:
    """Missing reference entries follow the recursive secret-wildcard fallback."""
    stored: list[dict[str, str]] = [
        {"host": "a", "password": "secret-a"},
        {"host": "b", "password": "secret-b"},
    ]
    submitted: list[dict[str, str]] = [
        {"host": "a", "password": PASSWORD_MASK},
        {"host": "b", "password": PASSWORD_MASK},
    ]
    assert unmask_configuration(stored, submitted, submitted[:1]) == stored


@pytest.mark.parametrize("error_class", [TypeError, AttributeError])
def test_masking_diagnostic_excludes_exception_message(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    error_class: type[Exception],
) -> None:
    """Only the exception class and provider identifier reach warning logs."""
    mocker.patch.object(
        masking, "_is_secret_schema", side_effect=error_class("EXCEPTION-SECRET")
    )
    assert masking._mask_value(
        {"password": "VALUE-SECRET"}, {}, {}, "test-provider"
    ) == {"password": PASSWORD_MASK}
    assert error_class.__name__ in caplog.text
    assert "test-provider" in caplog.text
    assert "EXCEPTION-SECRET" not in caplog.text
    assert "VALUE-SECRET" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)
