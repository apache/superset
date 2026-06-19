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
from flask_babel import lazy_gettext as _
from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    UpdateFailedError,
    ValidationError,
)


class FolderForbiddenError(ForbiddenError):
    message = _("You don't have permission to access this folder.")


class FolderInvalidError(CommandInvalidError):
    message = _("Folder parameters are invalid.")


class FolderNotFoundError(CommandException):
    status = 404
    message = _("Folder not found.")


class FolderCreateFailedError(CreateFailedError):
    message = _("Folder could not be created.")


class FolderUpdateFailedError(UpdateFailedError):
    message = _("Folder could not be updated.")


class FolderDeleteFailedError(DeleteFailedError):
    message = _("Folder could not be deleted.")


class FolderNameUniquenessValidationError(ValidationError):
    """A sibling folder of the same type already uses this name."""

    def __init__(self) -> None:
        super().__init__(
            [_("A folder with this name already exists in this location")],
            field_name="name",
        )


class FolderParentNotFoundValidationError(ValidationError):
    """The referenced parent folder does not exist."""

    def __init__(self) -> None:
        super().__init__([_("Parent folder not found")], field_name="parent_uuid")


class FolderParentTypeMismatchValidationError(ValidationError):
    """The parent folder belongs to a different folder type."""

    def __init__(self) -> None:
        super().__init__(
            [_("Parent folder belongs to a different folder type")],
            field_name="parent_uuid",
        )


class FolderCycleValidationError(ValidationError):
    """A move would place a folder inside itself or a descendant."""

    def __init__(self) -> None:
        super().__init__(
            [_("Cannot move a folder into itself or one of its descendants")],
            field_name="parent_uuid",
        )


class FolderTypeValidationError(ValidationError):
    """The folder_type is not a recognised namespace."""

    def __init__(self, folder_type: str) -> None:
        super().__init__(
            [_("Unknown folder type: '%(type)s'", type=folder_type)],
            field_name="folder_type",
        )


class FolderAssetNotFoundValidationError(ValidationError):
    """A referenced asset does not exist."""

    def __init__(self, asset_type: str, asset_id: int) -> None:
        super().__init__(
            [_("%(type)s %(id)s not found", type=asset_type, id=asset_id)],
            field_name="assets",
        )


class FolderAssetTypeValidationError(ValidationError):
    """An asset kind cannot be placed in a folder of this type."""

    def __init__(self, asset_type: str, folder_type: str) -> None:
        super().__init__(
            [
                _(
                    "Assets of type '%(type)s' cannot be added to a "
                    "'%(folder_type)s' folder",
                    type=asset_type,
                    folder_type=folder_type,
                )
            ],
            field_name="assets",
        )
