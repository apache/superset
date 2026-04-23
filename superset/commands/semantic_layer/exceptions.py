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
)


class SemanticViewNotFoundError(CommandException):
    status = 404
    message = _("Semantic view does not exist")


class SemanticViewForbiddenError(ForbiddenError):
    message = _("Changing this semantic view is forbidden")


class SemanticViewInvalidError(CommandInvalidError):
    message = _("Semantic view parameters are invalid.")


class SemanticViewUpdateFailedError(UpdateFailedError):
    message = _("Semantic view could not be updated.")


class SemanticLayerNotFoundError(CommandException):
    status = 404
    message = _("Semantic layer does not exist")


class SemanticLayerForbiddenError(ForbiddenError):
    message = _("Changing this semantic layer is forbidden")


class SemanticLayerInvalidError(CommandInvalidError):
    message = _("Semantic layer parameters are invalid.")


class SemanticLayerCreateFailedError(CreateFailedError):
    message = _("Semantic layer could not be created.")


class SemanticLayerUpdateFailedError(UpdateFailedError):
    message = _("Semantic layer could not be updated.")


class SemanticLayerDeleteFailedError(DeleteFailedError):
    message = _("Semantic layer could not be deleted.")


class SemanticViewCreateFailedError(CreateFailedError):
    message = _("Semantic view could not be created.")


class SemanticViewDeleteFailedError(DeleteFailedError):
    message = _("Semantic view could not be deleted.")
