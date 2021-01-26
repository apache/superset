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
from typing import List, Optional

from flask_appbuilder.security.sqla.models import User

from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    OwnersNotFoundValidationError,
)
from superset.connectors.base.models import BaseDatasource
from superset.connectors.connector_registry import ConnectorRegistry
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.extensions import db, security_manager


def populate_owners(user: User, owners_ids: Optional[List[int]] = None) -> List[User]:
    """
    Helper function for commands, will fetch all users from owners id's
    Can raise ValidationError
    :param user: The current user
    :param owners_ids: A List of owners by id's
    """
    owners = list()
    if not owners_ids:
        return [user]
    if user.id not in owners_ids:
        owners.append(user)
    for owner_id in owners_ids:
        owner = security_manager.get_user_by_id(owner_id)
        if not owner:
            raise OwnersNotFoundValidationError()
        owners.append(owner)
    return owners


def get_datasource_by_id(datasource_id: int, datasource_type: str) -> BaseDatasource:
    try:
        return ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
    except DatasetNotFoundError:
        raise DatasourceNotFoundValidationError()
