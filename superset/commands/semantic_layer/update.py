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

import logging
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from sqlalchemy.exc import SQLAlchemyError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerForbiddenError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.commands.semantic_layer.utils import validate_configuration
from superset.commands.utils import current_user_can_modify_object
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.masking import (
    mask_configuration,
    MaskedListUpdateError,
    unmask_configuration,
)
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry, semantic_layer_context
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def unmask_stored_configuration(
    existing_raw_configuration: str | None,
    new_configuration: dict[str, Any],
    layer_type: str,
) -> dict[str, Any]:
    """Replace ``PASSWORD_MASK`` sentinels in an update payload with the stored
    value at the same path, at any depth.

    The GET/list endpoints mask secret configuration values (see
    ``superset.semantic_layers.api._mask_configuration``); a client that
    round-trips that response back on an update (e.g. a name-only edit) would
    otherwise overwrite the real stored values with the mask string. This
    delegates to :func:`superset.semantic_layers.masking.unmask_configuration`,
    which restores masked values recursively so nested/union secrets survive
    the round-trip too, not just top-level ones.

    Restoring a stored value is allowed only for an unchanged masked read
    payload. Compare against the public reference so explicit secret guesses
    never produce different outcomes based on the stored credential. This
    covers credentials nested in objects and lists. Configuration changes
    require explicit credentials instead of masks.
    """
    try:
        existing_configuration: dict[str, Any] = (
            json.loads(existing_raw_configuration) if existing_raw_configuration else {}
        )
    except (TypeError, ValueError):
        existing_configuration = {}

    masked_reference: dict[str, Any] = mask_configuration(
        layer_type, existing_configuration
    )
    try:
        resolved = unmask_configuration(
            existing_configuration, new_configuration, masked_reference
        )
        public_round_trip = unmask_configuration(
            masked_reference, new_configuration, masked_reference
        )
    except MaskedListUpdateError as ex:
        raise SemanticLayerInvalidError(str(ex)) from None

    if resolved != new_configuration and public_round_trip != masked_reference:
        raise SemanticLayerInvalidError(
            "This update changes the configuration while reusing a stored "
            "secret value (a masked field). Provide the real value for any "
            "masked field to confirm a configuration change."
        )
    return resolved


class UpdateSemanticViewCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: SemanticView | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticViewUpdateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        assert self._model
        return SemanticViewDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = SemanticViewDAO.find_by_id(self._model_id)
        if not self._model:
            raise SemanticViewNotFoundError()
        try:
            self._model.raise_for_access()
        except SupersetSecurityException as ex:
            raise SemanticViewForbiddenError() from ex

        if not current_user_can_modify_object(self._model):
            raise SemanticViewForbiddenError()

        name = self._properties.get("name", self._model.name)
        layer_uuid = str(self._model.semantic_layer_uuid)
        configuration = self._properties.get(
            "configuration",
            json.loads(self._model.configuration),
        )
        if not SemanticViewDAO.validate_update_uniqueness(
            view_uuid=str(self._model.uuid),
            name=name,
            layer_uuid=layer_uuid,
            configuration=configuration,
        ):
            raise ValueError(
                f"A semantic view with name '{name}' and the same "
                "configuration already exists in this semantic layer."
            )


def _load_modifiable_layer(uuid: str) -> SemanticLayer:
    """Load a connection with the shared access and modification policy."""
    layer: SemanticLayer | None = SemanticLayerDAO.find_by_uuid(uuid)
    if not layer:
        raise SemanticLayerNotFoundError()
    try:
        layer.raise_for_access()
    except SupersetSecurityException as ex:
        raise SemanticLayerForbiddenError() from ex
    if not current_user_can_modify_object(layer):
        raise SemanticLayerForbiddenError()
    return layer


class UpdateSemanticLayerCommand(BaseCommand):
    def __init__(self, uuid: str, data: dict[str, Any]):
        self._uuid = uuid
        self._properties = data.copy()
        self._model: SemanticLayer | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticLayerUpdateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        assert self._model
        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = json.dumps(
                self._properties["configuration"]
            )
        if "configuration" in self._properties:
            try:
                unchanged: bool = json.dumps(
                    json.loads(self._model.configuration), sort_keys=True
                ) == json.dumps(
                    json.loads(self._properties["configuration"]), sort_keys=True
                )
            except (TypeError, ValueError):
                unchanged = False
            if unchanged:
                # Avoid overwriting a concurrent edit with this reader's old config.
                self._properties.pop("configuration")
            else:
                self._model.clear_metadata_cache()
        return SemanticLayerDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = _load_modifiable_layer(self._uuid)

        name = self._properties.get("name")
        if name and not SemanticLayerDAO.validate_update_uniqueness(self._uuid, name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = unmask_stored_configuration(
                self._model.configuration,
                self._properties["configuration"],
                self._model.type,
            )

        if "configuration" in self._properties:
            configuration: dict[str, Any] = self._properties["configuration"]
            sl_type: str = self._model.type
            if sl_type not in registry:
                raise SemanticLayerInvalidError(f"Unknown type: {sl_type}")
            with semantic_layer_context(sl_type):
                validate_configuration(registry[sl_type], configuration)


class ClearSemanticLayerCacheCommand(BaseCommand):
    """Invalidate a saved connection's metadata without fetching its provider."""

    def __init__(self, uuid: str) -> None:
        self._uuid: str = uuid
        self._model: SemanticLayer | None = None

    def validate(self) -> None:
        """Require connection management authority, including for direct callers."""
        if security_manager.is_guest_user() or not security_manager.can_access(
            "can_write", "SemanticLayer"
        ):
            raise SemanticLayerForbiddenError()
        self._model = _load_modifiable_layer(self._uuid)

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticLayerUpdateFailedError,
        )
    )
    def run(self) -> Model:
        """Return only after the cache generation has committed."""
        self.validate()
        assert self._model
        self._model.clear_metadata_cache()
        return self._model
