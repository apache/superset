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

from typing import Any, Optional, Union

from superset import security_manager
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.query import SavedQueryDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.models import ObjectType


def to_object_type(object_type: Union[ObjectType, int, str]) -> Optional[ObjectType]:
    if isinstance(object_type, ObjectType):
        return object_type
    for type_ in ObjectType:
        if object_type in [type_.value, type_.name]:
            return type_
    return None


def to_object_model(
    object_type: ObjectType, object_id: int, skip_base_filter: bool = False
) -> Optional[Union[Dashboard, SavedQuery, Slice, Any]]:
    if ObjectType.dashboard == object_type:
        return DashboardDAO.find_by_id(object_id, skip_base_filter=skip_base_filter)
    if ObjectType.query == object_type:
        return SavedQueryDAO.find_by_id(object_id, skip_base_filter=skip_base_filter)
    if ObjectType.chart == object_type:
        return ChartDAO.find_by_id(object_id, skip_base_filter=skip_base_filter)
    if ObjectType.dataset == object_type:
        # Imported lazily to avoid a circular import via superset.views.base
        from superset.daos.dataset import DatasetDAO

        return DatasetDAO.find_by_id(object_id, skip_base_filter=skip_base_filter)
    return None


def current_user_can_modify_object(model: Any) -> bool:
    """Whether the current user may create/modify tag relationships on ``model``.

    Mirrors the editorship check the bulk-create path already applies, or the
    object's creator, so the tag-update path enforces the same boundary.
    Look the model up with
    ``skip_base_filter=True`` before calling this, so an object the user cannot
    access reaches the check instead of resolving to ``None`` and being written
    without any check.
    """
    try:
        security_manager.raise_for_editorship(model)
        return True
    except SupersetSecurityException:
        return bool(
            model.created_by and model.created_by == security_manager.current_user
        )
