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
"""Exceptions for semantic layer commands."""

from flask_babel import lazy_gettext as _
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class SemanticLayerInvalidError(CommandInvalidError):
    """Semantic layer parameters are invalid."""

    message = _("Semantic layer parameters are invalid.")


class SemanticLayerNotFoundError(ObjectNotFoundError):
    """Semantic layer not found."""

    def __init__(self) -> None:
        super().__init__("Semantic layer", None)


class SemanticLayerCreateFailedError(CreateFailedError):
    """Semantic layer could not be created."""

    message = _("Semantic layer could not be created.")


class SemanticLayerUpdateFailedError(UpdateFailedError):
    """Semantic layer could not be updated."""

    message = _("Semantic layer could not be updated.")


class SemanticLayerDeleteFailedError(DeleteFailedError):
    """Semantic layer could not be deleted."""

    message = _("Semantic layer could not be deleted.")


class SemanticLayerRequiredFieldValidationError(ValidationError):
    """Required field validation error."""

    def __init__(self, field_name: str) -> None:
        super().__init__([_("Field is required")], field_name=field_name)


class SemanticLayerExistsValidationError(ValidationError):
    """Semantic layer already exists validation error."""

    def __init__(self) -> None:
        super().__init__(
            [_("A semantic layer with this name already exists")],
            field_name="name",
        )
