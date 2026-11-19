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

from superset.daos.base import BaseDAO
from superset.subjects.models import Subject


class SubjectDAO(BaseDAO[Subject]):
    """DAO for the Subject model.

    Subjects are derived from Users, Roles, and Groups (kept in sync via hooks),
    so this DAO only needs the read/create/delete operations inherited from
    ``BaseDAO``.
    """
