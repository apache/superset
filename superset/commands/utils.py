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

from typing import List, Optional, TYPE_CHECKING

from flask_appbuilder.security.sqla.models import Role, User

from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    OwnersNotFoundValidationError,
    RolesNotFoundValidationError,
)
from superset.connectors.connector_registry import ConnectorRegistry
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.extensions import db, security_manager

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource


def populate_owners(
    user: User, owner_ids: Optional[List[int]], default_to_user: bool,
) -> List[User]:
    """
    Helper function for commands, will fetch all users from owners id's
    :param user: current user
    :param owner_ids: list of owners by id's
    :param default_to_user: make user the owner if `owner_ids` is None or empty
    :raises OwnersNotFoundValidationError: if at least one owner id can't be resolved
    :returns: Final list of owners
    """
    owner_ids = owner_ids or []
    owners = []
    if not owner_ids and default_to_user:
        return [user]
    if user.id not in owner_ids and "admin" not in [
        role.name.lower() for role in user.roles
    ]:
        # make sure non-admins can't remove themselves as owner by mistake
        owners.append(user)
    for owner_id in owner_ids:
        owner = security_manager.get_user_by_id(owner_id)
        if not owner:
            raise OwnersNotFoundValidationError()
        owners.append(owner)
    return owners


def populate_roles(role_ids: Optional[List[int]] = None) -> List[Role]:
    """
    Helper function for commands, will fetch all roles from roles id's
     :raises RolesNotFoundValidationError: If a role in the input list is not found
    :param role_ids: A List of roles by id's
    """
    roles: List[Role] = []
    if role_ids:
        roles = security_manager.find_roles_by_id(role_ids)
        if len(roles) != len(role_ids):
            raise RolesNotFoundValidationError()
    return roles


def get_datasource_by_id(datasource_id: int, datasource_type: str) -> BaseDatasource:
    try:
        return ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
    except DatasetNotFoundError as ex:
        raise DatasourceNotFoundValidationError() from ex
