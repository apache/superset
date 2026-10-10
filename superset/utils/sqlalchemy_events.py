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
"""Typed declarations for SQLAlchemy deletion-listener effects."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from threading import RLock
from typing import Any

import sqlalchemy as sa


class DeleteListenerEffect(str, Enum):
    """Classify the durable effect of an ORM deletion listener."""

    PERSISTENT_RECORD = "persistent_record"
    PERMISSION_ARTIFACT = "permission_artifact"
    OBSERVATIONAL = "observational"


@dataclass(frozen=True)
class DeleteListenerDeclaration:
    """Describe one supported-root ``after_delete`` listener."""

    target: type[Any]
    responsibility: str
    effect: DeleteListenerEffect
    listener: Callable[..., None]

    @property
    def key(self) -> tuple[type[Any], str]:
        """Return the stable catalog key for this declaration."""
        return self.target, self.responsibility


_DELETE_LISTENERS: dict[tuple[type[Any], str], DeleteListenerDeclaration] = {}
_DELETE_LISTENER_LOCK: RLock = RLock()


def register_delete_listener(declaration: DeleteListenerDeclaration) -> None:
    """Register a declared listener idempotently."""
    with _DELETE_LISTENER_LOCK:
        existing: DeleteListenerDeclaration | None = _DELETE_LISTENERS.get(
            declaration.key
        )
        if existing is not None and existing != declaration:
            raise ValueError(
                "Conflicting delete-listener declaration: "
                f"{declaration.target.__name__}.{declaration.responsibility}"
            )
        _DELETE_LISTENERS[declaration.key] = declaration
        if not sa.event.contains(
            declaration.target, "after_delete", declaration.listener
        ):
            sa.event.listen(declaration.target, "after_delete", declaration.listener)


def remove_delete_listener(declaration: DeleteListenerDeclaration) -> None:
    """Remove a declared listener while preserving catalog identity."""
    with _DELETE_LISTENER_LOCK:
        existing: DeleteListenerDeclaration | None = _DELETE_LISTENERS.get(
            declaration.key
        )
        if existing is not None and existing != declaration:
            raise ValueError(
                "Conflicting delete-listener declaration: "
                f"{declaration.target.__name__}.{declaration.responsibility}"
            )
        if sa.event.contains(declaration.target, "after_delete", declaration.listener):
            sa.event.remove(declaration.target, "after_delete", declaration.listener)
        _DELETE_LISTENERS.pop(declaration.key, None)


def declared_delete_listeners() -> tuple[DeleteListenerDeclaration, ...]:
    """Return declared listeners in deterministic order."""
    with _DELETE_LISTENER_LOCK:
        return tuple(
            sorted(
                _DELETE_LISTENERS.values(),
                key=lambda declaration: (
                    declaration.target.__module__,
                    declaration.target.__qualname__,
                    declaration.responsibility,
                ),
            )
        )
