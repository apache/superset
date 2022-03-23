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
from dataclasses import dataclass
from enum import Enum
from typing import Optional, TypedDict
from uuid import UUID


@dataclass
class Key:
    id: Optional[int]
    uuid: Optional[UUID]


class KeyValueFilter(TypedDict, total=False):
    resource: str
    id: Optional[int]
    uuid: Optional[UUID]


class KeyValueResource(str, Enum):
    APP = "app"
    DASHBOARD_PERMALINK = "dashboard_permalink"
    EXPLORE_PERMALINK = "explore_permalink"
    METASTORE_CACHE = "superset_metastore_cache"


class SharedKey(str, Enum):
    DASHBOARD_PERMALINK_SALT = "dashboard_permalink_salt"
    EXPLORE_PERMALINK_SALT = "explore_permalink_salt"
