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

from typing import Optional, Union

from superset import db
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
    object_type: ObjectType, object_id: int
) -> Optional[Union[Dashboard, SavedQuery, Slice]]:
    """Load a model instance by type and id.

    Uses db.session.get() instead of DAO.find_by_id() to avoid DAO base
    filters that require request context. Authorization is enforced by the
    caller via raise_for_access() on the returned object.
    """
    model_map: dict[ObjectType, type] = {
        ObjectType.dashboard: Dashboard,
        ObjectType.query: SavedQuery,
        ObjectType.chart: Slice,
    }
    model_cls = model_map.get(object_type)
    if model_cls is None:
        return None
    return db.session.get(model_cls, object_id)
