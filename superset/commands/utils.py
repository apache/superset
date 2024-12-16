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

from typing import Any, TYPE_CHECKING

from flask import g
from flask_appbuilder.security.sqla.models import Role, User

from superset import security_manager
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    OwnersNotFoundValidationError,
    RolesNotFoundValidationError,
)
from superset.daos.datasource import DatasourceDAO
from superset.utils import json
from superset.daos.exceptions import DatasourceNotFound
from superset.utils.core import DatasourceType, get_user_id

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource


def populate_owner_list(
    owner_ids: list[int] | None,
    default_to_user: bool,
) -> list[User]:
    """
    Helper function for commands, will fetch all users from owners id's

    :param owner_ids: list of owners by id's
    :param default_to_user: make user the owner if `owner_ids` is None or empty
    :raises OwnersNotFoundValidationError: if at least one owner id can't be resolved
    :returns: Final list of owners
    """
    owner_ids = owner_ids or []
    owners = []
    if not owner_ids and default_to_user:
        return [g.user]
    if not (security_manager.is_admin() or get_user_id() in owner_ids):
        # make sure non-admins can't remove themselves as owner by mistake
        owners.append(g.user)
    for owner_id in owner_ids:
        owner = security_manager.get_user_by_id(owner_id)
        if not owner:
            raise OwnersNotFoundValidationError()
        owners.append(owner)
    return owners


def compute_owner_list(
    current_owners: list[User] | None,
    new_owners: list[int] | None,
) -> list[User]:
    """
    Helper function for update commands, to properly handle the owners list.
    Preserve the previous configuration unless included in the update payload.

    :param current_owners: list of current owners
    :param new_owners: list of new owners specified in the update payload
    :returns: Final list of owners
    """
    current_owners = current_owners or []
    owners_ids = (
        [owner.id for owner in current_owners] if new_owners is None else new_owners
    )
    return populate_owner_list(owners_ids, default_to_user=False)


def populate_roles(role_ids: list[int] | None = None) -> list[Role]:
    """
    Helper function for commands, will fetch all roles from roles id's
     :raises RolesNotFoundValidationError: If a role in the input list is not found
    :param role_ids: A List of roles by id's
    """
    roles: list[Role] = []
    if role_ids:
        roles = security_manager.find_roles_by_id(role_ids)
        if len(roles) != len(role_ids):
            raise RolesNotFoundValidationError()
    return roles


def get_datasource_by_id(datasource_id: int, datasource_type: str) -> BaseDatasource:
    try:
        return DatasourceDAO.get_datasource(
            DatasourceType(datasource_type), datasource_id
        )
    except DatasourceNotFound as ex:
        raise DatasourceNotFoundValidationError() from ex


def update_chart_config_dataset(
    config: dict[str, Any], dataset_info: dict[str, Any]
) -> dict[str, Any]:
    """
    Update the chart configuration and query_context with new dataset information

    :param config: The original chart configuration
    :param dataset_info: Dict with datasource_id, datasource_type, and datasource_name
    :return: The updated chart configuration
    """
    # Update datasource id, type, and name
    config.update(dataset_info)

    dataset_uid = f"{dataset_info['datasource_id']}__{dataset_info['datasource_type']}"
    config["params"].update({"datasource": dataset_uid})

    if "query_context" in config and config["query_context"] is not None:
        try:
            query_context = json.loads(config["query_context"])

            query_context["datasource"] = {
                "id": dataset_info["datasource_id"],
                "type": dataset_info["datasource_type"],
            }

            if "form_data" in query_context:
                query_context["form_data"]["datasource"] = dataset_uid

            if "queries" in query_context:
                for query in query_context["queries"]:
                    if "datasource" in query:
                        query["datasource"] = query_context["datasource"]

            config["query_context"] = json.dumps(query_context)
        except json.JSONDecodeError:
            config["query_context"] = None

    return config
