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

from typing import Annotated, Any, Literal, Union
from unittest.mock import patch

from pydantic import BaseModel, Field, SecretStr

from superset.constants import PASSWORD_MASK
from superset.semantic_layers.masking import (
    _is_secret_schema,
    _mask_all,
    mask_configuration,
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
    config = {
        "account": "acme",
        "auth": {"kind": "password", "password": "hunter2"},
        "token": "tok-123",
        "warehouses": ["small", "large"],
    }
    with _register():
        masked = mask_configuration("demo", config)
    assert masked == {
        "account": "acme",
        "auth": {"kind": "password", "password": PASSWORD_MASK},
        "token": PASSWORD_MASK,
        "warehouses": ["small", "large"],
    }


def test_mask_covers_every_union_variant() -> None:
    """Secrets in a discriminated-union variant mask, incl. optional ones."""
    config = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": "pp"},
    }
    with _register():
        masked = mask_configuration("demo", config)
    assert masked["auth"] == {
        "kind": "key",
        "private_key": PASSWORD_MASK,
        "passphrase": PASSWORD_MASK,
    }


def test_mask_leaves_null_secrets_null() -> None:
    """A secret that is not set stays visibly unset, not masked."""
    config = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": None},
        "token": None,
    }
    with _register():
        masked = mask_configuration("demo", config)
    assert masked["token"] is None
    assert masked["auth"]["passphrase"] is None


def test_mask_fails_closed_without_a_registered_provider() -> None:
    """No registered schema: every scalar masks (nothing can be vouched for)."""
    config = {"account": "acme", "nested": {"password": "x", "port": 443}}
    masked = mask_configuration("unknown-type", config)
    assert masked == {
        "account": PASSWORD_MASK,
        "nested": {"password": PASSWORD_MASK, "port": PASSWORD_MASK},
    }


def test_reveals_keys_the_schema_does_not_describe_but_masks_marked_secrets() -> None:
    """A key no schema property describes is revealed (matching #43474); a
    field the schema marks secret is still masked even alongside it."""
    config = {
        "account": "acme",
        "auth": {"kind": "password", "password": "x"},
        "legacy_field": "kept",
    }
    with _register():
        masked = mask_configuration("demo", config)
    assert masked["legacy_field"] == "kept"  # undescribed -> revealed
    assert masked["account"] == "acme"
    assert masked["auth"]["password"] == PASSWORD_MASK  # nested secret -> masked


def test_mask_empty_or_non_dict_configuration_is_empty() -> None:
    assert mask_configuration("demo", None) == {}
    assert mask_configuration("demo", {}) == {}
    assert mask_configuration("demo", "not-a-dict") == {}


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

    value = {"endpoint": {"kind": "secret", "conn": {"host": "h", "password": "s3"}}}
    with patch.dict(
        "superset.semantic_layers.registry.registry", {"divergent": DivergentType}
    ):
        masked = mask_configuration("divergent", value)
    # host stays visible in both variants; the password (present only in the
    # secret variant) must be masked, not passed through via the plain branch.
    assert masked["endpoint"]["conn"]["host"] == "h"
    assert masked["endpoint"]["conn"]["password"] == PASSWORD_MASK


def test_unmask_swaps_sentinels_from_the_stored_configuration() -> None:
    """Echoed masks restore stored secrets; edited fields keep new values."""
    stored = {
        "account": "acme",
        "auth": {"kind": "password", "password": "hunter2"},
        "token": "tok-123",
    }
    submitted = {
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
    """A mask with no stored counterpart is not invented; validation rejects it."""
    submitted = {"auth": {"kind": "password", "password": PASSWORD_MASK}}
    assert unmask_configuration({}, submitted) == submitted


def test_unmask_handles_lists_pairwise() -> None:
    stored = {"keys": ["k1", "k2"]}
    submitted = {"keys": [PASSWORD_MASK, "new-k2", PASSWORD_MASK]}
    assert unmask_configuration(stored, submitted) == {
        "keys": ["k1", "new-k2", PASSWORD_MASK]
    }


def test_mask_then_unmask_round_trips_to_the_stored_configuration() -> None:
    """An untouched echo of a masked read must reproduce the stored config."""
    stored = {
        "account": "acme",
        "auth": {"kind": "key", "private_key": "PEM...", "passphrase": "pp"},
        "token": "tok-123",
        "warehouses": ["small"],
    }
    with _register():
        echoed = mask_configuration("demo", stored)
    assert unmask_configuration(stored, echoed) == stored


class _FakeProvider:
    """A provider stand-in whose get_configuration_schema is caller-controlled."""

    def __init__(self, schema: Any = None, raises: bool = False) -> None:
        self._schema = schema
        self._raises = raises

    def get_configuration_schema(self, configuration: Any = None) -> Any:
        if self._raises:
            raise RuntimeError("schema generation failed")
        return self._schema


def _with_schema(schema: Any) -> Any:
    return patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": _FakeProvider(schema)},
    )


def test_unresolvable_ref_reveals_its_subtree() -> None:
    """A $ref into a missing $defs is unknowable at that position, so its
    subtree is revealed rather than masked --- consistent with #43474, which
    reveals any object it cannot classify as secret. (A real provider schema
    resolves its refs; only the whole-schema-unavailable case fails closed.)
    """
    schema = {
        "type": "object",
        "properties": {"conn": {"$ref": "#/$defs/Missing"}},
        "$defs": {},
    }
    with _with_schema(schema):
        masked = mask_configuration("fake", {"conn": {"host": "h"}})
    assert masked["conn"] == {"host": "h"}


def test_untyped_array_is_revealed() -> None:
    """A list field whose schema declares no item type carries no marked
    secret, so it is revealed (matching #43474's reveal-unless-marked rule)."""
    schema = {
        "type": "object",
        "properties": {"tags": {"type": "array"}},
        "$defs": {},
    }
    with _with_schema(schema):
        masked = mask_configuration("fake", {"tags": ["a", "b"]})
    assert masked["tags"] == ["a", "b"]


def test_mask_fails_closed_when_schema_generation_raises() -> None:
    """If the provider's get_configuration_schema raises, mask everything."""
    with patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": _FakeProvider(raises=True)},
    ):
        masked = mask_configuration("fake", {"account": "acme", "password": "x"})
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

    value = {"conn": {"kind": "plain", "items": ["x", "y"]}}
    with patch.dict(
        "superset.semantic_layers.registry.registry",
        {"fake": DivergentListType},
    ):
        masked = mask_configuration("fake", value)
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
        masked = mask_configuration("fake", {"account": "acme", "password": "x"})
    assert masked == {"account": PASSWORD_MASK, "password": PASSWORD_MASK}


def test_additionalproperties_divergent_union_variants_mask_conservatively() -> None:
    """A free-form key is masked when any union variant's additionalProperties
    marks it secret, even if an *earlier* variant would reveal it.

    Guards Amin's Finding 1: the object masker must classify free-form keys
    against every variant's additionalProperties, not just the first. Here the
    first (plain) variant would reveal the key; the second (secret) variant
    must still force a mask.
    """
    schema = {
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
        masked = mask_configuration("fake", {"kind": "plain", "extra": "sensitive"})
    assert masked["kind"] == "plain"
    assert masked["extra"] == PASSWORD_MASK
