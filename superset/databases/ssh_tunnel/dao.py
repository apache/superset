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
import logging
from typing import Any, Dict

from superset.constants import PASSWORD_MASK
from superset.dao.base import BaseDAO
from superset.databases.ssh_tunnel.models import SSHTunnel

logger = logging.getLogger(__name__)


class SSHTunnelDAO(BaseDAO):
    model_cls = SSHTunnel

    @classmethod
    def update(
        cls,
        model: SSHTunnel,
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> SSHTunnel:
        """
        Unmask ``password``, ``private_key`` and ``private_key_password`` before updating.

        When a database is edited the user sees a masked version of
        the aforementioned fields.

        The masked values should be unmasked before the ssh tunnel is updated.
        """
        if properties.get("password") == PASSWORD_MASK:
            properties["password"] = model.password
        if properties.get("private_key") == PASSWORD_MASK:
            properties["private_key"] = model.private_key
        if properties.get("private_key_password") == PASSWORD_MASK:
            properties["private_key_password"] = model.private_key_password

        return super().update(model, properties, commit)
