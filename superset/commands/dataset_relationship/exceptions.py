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
"""Custom exceptions for dataset relationship commands."""

from flask_babel import lazy_gettext as _
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    UpdateFailedError,
)


class DatasetRelationshipNotFoundError(CommandException):
    """Raised when a dataset relationship cannot be found."""

    status = 404
    message = _("Dataset relationship does not exist.")


class DatasetRelationshipInvalidError(CommandInvalidError):
    """Raised when dataset relationship parameters fail validation."""

    message = _("Dataset relationship parameters are invalid.")


class DatasetRelationshipCreateFailedError(CreateFailedError):
    """Raised when creation of a dataset relationship fails."""

    message = _("Dataset relationship could not be created.")


class DatasetRelationshipUpdateFailedError(UpdateFailedError):
    """Raised when update of a dataset relationship fails."""

    message = _("Dataset relationship could not be updated.")


class DatasetRelationshipDeleteFailedError(DeleteFailedError):
    """Raised when deletion of a dataset relationship fails."""

    message = _("Dataset relationship could not be deleted.")


class DatasetRelationshipForbiddenError(ForbiddenError):
    """Raised when the current user is not allowed to modify the relationship."""

    message = _("Changing this dataset relationship is forbidden.")


class DatasetRelationshipExistsValidationError(ValidationError):
    """Marshmallow validation error for duplicate relationship."""

    def __init__(self) -> None:
        super().__init__(
            [
                _(
                    "A relationship between these two datasets already exists."
                )
            ],
            field_name="source_dataset_id",
        )


class DatasetRelationshipSelfReferenceValidationError(ValidationError):
    """Marshmallow validation error when source and target are the same."""

    def __init__(self) -> None:
        super().__init__(
            [_("Source and target datasets must be different.")],
            field_name="target_dataset_id",
        )


class DatasetRelationshipSourceNotFoundValidationError(ValidationError):
    """Marshmallow validation error when the source dataset does not exist."""

    def __init__(self) -> None:
        super().__init__(
            [_("Source dataset does not exist.")],
            field_name="source_dataset_id",
        )


class DatasetRelationshipTargetNotFoundValidationError(ValidationError):
    """Marshmallow validation error when the target dataset does not exist."""

    def __init__(self) -> None:
        super().__init__(
            [_("Target dataset does not exist.")],
            field_name="target_dataset_id",
        )


class DatasetRelationshipColumnsValidationError(ValidationError):
    """Marshmallow validation error for invalid column mappings."""

    def __init__(self, message: str | None = None) -> None:
        super().__init__(
            [_(message or "Column mappings are invalid.")],
            field_name="columns",
        )
