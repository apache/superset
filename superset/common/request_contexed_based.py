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

from typing import List, TYPE_CHECKING

from flask import g

from superset import conf, security_manager

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import Role


def get_user_roles() -> List[Role]:
    if g.user.is_anonymous:
        public_role = conf.get("AUTH_ROLE_PUBLIC")
        return [security_manager.get_public_role()] if public_role else []
    return g.user.roles


def is_user_admin() -> bool:
    user_roles = [role.name.lower() for role in get_user_roles()]
    admin_role = conf.get("AUTH_ROLE_ADMIN").lower()
    return admin_role in user_roles
