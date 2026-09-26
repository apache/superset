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
from superset.constants import PASSWORD_MASK
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.masking import (
    mask_configuration,
    MaskedListUpdateError,
    unmask_configuration,
)
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)

# Sentinel distinguishing "key absent" from "key present with value None"
# when reading the stored configuration -- dict.get's own default can't.
_MISSING = object()


def _unmask_configuration(
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

    A masked top-level key is only ever restored, though, when every OTHER
    submitted top-level key is unchanged from what's stored -- including a
    stored key being dropped from the payload -- i.e. this is a pure "reveal
    what I was shown masked" round-trip, not an edit that also changes some
    other connector field. Without that check, an editor (entitled to edit
    this connection, but not to see its real secret -- that's the entire
    reason GET/list mask it) could reveal a masked value while simultaneously
    changing a destination-relevant field in the same request, poisoning the
    stored configuration: the very next legitimate call through this layer
    (``POST /<uuid>/schema/runtime`` always uses the stored, now-poisoned
    configuration) would send the real secret to wherever that field now
    points. Semantic layer connector schemas are pluggable and defined
    outside this repo (see ``superset/core/api/core_api_injection.py``), so
    unlike the analogous database-connection fix there's no fixed
    "destination fields" list to narrow this to -- any other top-level field
    changing at all is treated as unsafe to combine with a secret reveal.
    """
    try:
        existing_configuration: dict[str, Any] = (
            json.loads(existing_raw_configuration) if existing_raw_configuration else {}
        )
    except (TypeError, ValueError):
        existing_configuration = {}

    masked_keys = {
        key
        for key, value in new_configuration.items()
        if value == PASSWORD_MASK and key in existing_configuration
    }
    # `.get(key)` alone can't tell "key absent from storage" apart from "key
    # present and stored as None" -- both return None -- so a newly
    # introduced key with an explicit None value would be misread as
    # unchanged and let a masked secret slip through alongside it. A
    # sentinel default makes that distinction explicit. Iterating only the
    # submitted keys would also miss a REMOVED key: the update replaces the
    # stored dictionary wholesale, so dropping an optional field while
    # reusing the masked secret changes the effective configuration just as
    # surely as editing one.
    removed_keys = set(existing_configuration) - set(new_configuration)
    if masked_keys and (
        removed_keys
        or any(
            key not in masked_keys
            and existing_configuration.get(key, _MISSING) != value
            for key, value in new_configuration.items()
        )
    ):
        raise SemanticLayerInvalidError(
            "This update changes the configuration while reusing a stored "
            "secret value (a masked field). Provide the real value for any "
            "masked field to confirm a configuration change."
        )

    masked_reference: dict[str, Any] = mask_configuration(
        layer_type, existing_configuration
    )
    try:
        return unmask_configuration(
            existing_configuration, new_configuration, masked_reference
        )
    except MaskedListUpdateError as ex:
        raise SemanticLayerInvalidError(str(ex)) from None


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
        return SemanticLayerDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = SemanticLayerDAO.find_by_uuid(self._uuid)
        if not self._model:
            raise SemanticLayerNotFoundError()
        try:
            self._model.raise_for_access()
        except SupersetSecurityException as ex:
            raise SemanticLayerForbiddenError() from ex

        if not current_user_can_modify_object(self._model):
            raise SemanticLayerForbiddenError()

        name = self._properties.get("name")
        if name and not SemanticLayerDAO.validate_update_uniqueness(self._uuid, name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = _unmask_configuration(
                self._model.configuration,
                self._properties["configuration"],
                self._model.type,
            )

        if "configuration" in self._properties:
            configuration: dict[str, Any] = self._properties["configuration"]
            sl_type: str = self._model.type
            if sl_type not in registry:
                raise SemanticLayerInvalidError(f"Unknown type: {sl_type}")
            validate_configuration(registry[sl_type], configuration)
