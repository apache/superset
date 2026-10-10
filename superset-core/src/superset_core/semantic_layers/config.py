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

from __future__ import annotations

from typing import Any, get_args, get_origin, Iterator

from pydantic import BaseModel


def _iter_nested_models(
    annotation: Any, seen: set[type[BaseModel]]
) -> Iterator[type[BaseModel]]:
    """Yield every ``BaseModel`` subclass reachable from ``annotation``
    (through generics like ``list[...]``/``... | None``, and recursively
    through each found model's own fields), each at most once."""
    origin = get_origin(annotation)
    if origin is not None:
        for arg in get_args(annotation):
            yield from _iter_nested_models(arg, seen)
        return
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        model_cls: type[BaseModel] = annotation
        if model_cls not in seen:
            seen.add(model_cls)
            yield model_cls
            for field in model_cls.model_fields.values():
                yield from _iter_nested_models(field.annotation, seen)


def _resolve_field_order(
    model_cls: type[BaseModel], schema_node: dict[str, Any]
) -> list[str]:
    """The order ``schema_node["properties"]`` should render in: an explicit
    ``field_order: ClassVar[list[str]]`` on ``model_cls`` when declared
    (validated as an exact permutation of its own properties), else the
    model's field declaration order (by alias)."""
    declared_order = getattr(model_cls, "field_order", None)
    if declared_order is None:
        return [field.alias or name for name, field in model_cls.model_fields.items()]
    declared = set(declared_order)
    actual = set(schema_node.get("properties", {}))
    # A `set()` comparison alone can't catch a duplicate: `["a", "a", "b"]`
    # collapses to the same set as `["a", "b"]`, so a repeated entry would
    # otherwise pass this check and then be silently absorbed by `_reorder`'s
    # dict comprehension (a later duplicate key just overwrites the same
    # slot) rather than surfacing the invalid declaration.
    if len(declared_order) != len(declared) or declared != actual:
        raise ValueError(
            f"{model_cls.__name__}.field_order must be a permutation of its "
            f"schema properties; declared={sorted(declared_order)} "
            f"actual={sorted(actual)}"
        )
    return declared_order


def _reorder(schema_node: dict[str, Any], field_order: list[str]) -> None:
    """Reorder ``schema_node``'s ``properties`` (and, for determinism,
    ``required``) to match ``field_order``. Mutates in place."""
    if (properties := schema_node.get("properties")) is not None:
        schema_node["properties"] = {
            key: properties[key] for key in field_order if key in properties
        }
    if (required := schema_node.get("required")) is not None:
        index = {key: position for position, key in enumerate(field_order)}
        schema_node["required"] = sorted(
            required, key=lambda key: index.get(key, len(field_order))
        )


def build_configuration_schema(
    config_class: type[BaseModel],
    configuration: BaseModel | None = None,
) -> dict[str, Any]:
    """
    Build a JSON schema from a Pydantic configuration class.

    Handles generic boilerplate that any semantic layer with dynamic fields needs:

    - Reorders properties to match model field order (Pydantic sorts alphabetically),
      or an explicit ``field_order: ClassVar[list[str]]`` on a model when declared —
      needed because Pydantic always places an inherited field ahead of a
      subclass's own fields in ``model_fields``, regardless of where the subclass
      redeclares it, so composed models can't rely on declaration order alone.
      Applied to ``config_class`` itself *and* to every nested model that lands in
      the schema's ``$defs`` — a model's declared/inherited field order isn't only
      relevant when it's the top-level schema, and Pydantic emits ``$defs`` entries
      in each nested model's own (potentially inheritance-skewed) field order too.
    - When ``configuration`` is None, sets ``enum: []`` on all ``x-dynamic`` properties
      so the frontend renders them as empty dropdowns

    Semantic layer implementations call this instead of
    ``model_json_schema()`` directly,
    then only need to add their own dynamic population logic.
    """
    schema = config_class.model_json_schema()

    _reorder(schema, _resolve_field_order(config_class, schema))

    defs = schema.get("$defs", {})
    for nested_cls in _iter_nested_models(config_class, seen=set()):
        if nested_cls is config_class:
            continue
        def_entry = defs.get(nested_cls.__name__)
        if def_entry is None:
            continue
        _reorder(def_entry, _resolve_field_order(nested_cls, def_entry))

    if configuration is None:
        for prop_schema in schema["properties"].values():
            if prop_schema.get("x-dynamic"):
                prop_schema["enum"] = []

    return schema


def check_dependencies(
    prop_schema: dict[str, Any],
    configuration: BaseModel,
) -> bool:
    """
    Check whether a dynamic property's dependencies are satisfied.

    Reads the ``x-dependsOn`` list from the property schema and returns ``True``
    when every referenced attribute on ``configuration`` is truthy. Entries are
    written using the schema-facing alias (e.g. ``"dataBinding"``), so each is
    resolved to its Pydantic field name before ``getattr`` -- Pydantic attribute
    access always uses the field name, never the alias, even under
    ``populate_by_name=True``.
    """
    dependencies = prop_schema.get("x-dependsOn", [])
    alias_to_name = {
        (field.alias or name): name
        for name, field in type(configuration).model_fields.items()
    }
    return all(
        getattr(configuration, alias_to_name.get(dep, dep), None)
        for dep in dependencies
    )
