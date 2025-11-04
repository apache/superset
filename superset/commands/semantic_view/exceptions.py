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
"""Exceptions for semantic view commands."""

from flask_babel import lazy_gettext as _
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class SemanticViewInvalidError(CommandInvalidError):
    """Semantic view parameters are invalid."""

    message = _("Semantic view parameters are invalid.")


class SemanticViewNotFoundError(ObjectNotFoundError):
    """Semantic view not found."""

    def __init__(self) -> None:
        super().__init__("Semantic view", None)


class SemanticViewCreateFailedError(CreateFailedError):
    """Semantic view could not be created."""

    message = _("Semantic view could not be created.")


class SemanticViewUpdateFailedError(UpdateFailedError):
    """Semantic view could not be updated."""

    message = _("Semantic view could not be updated.")


class SemanticViewDeleteFailedError(DeleteFailedError):
    """Semantic view could not be deleted."""

    message = _("Semantic view could not be deleted.")


class SemanticViewRequiredFieldValidationError(ValidationError):
    """Required field validation error."""

    def __init__(self, field_name: str) -> None:
        super().__init__([_("Field is required")], field_name=field_name)


class SemanticViewExistsValidationError(ValidationError):
    """Semantic view already exists validation error."""

    def __init__(self) -> None:
        super().__init__(
            [_("A semantic view with this name already exists in this semantic layer")],
            field_name="name",
        )
