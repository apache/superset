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
from datetime import timedelta

from flask import Flask

from superset.engines.manager import EngineManager
from superset.utils.class_utils import load_class_from_name

logger = logging.getLogger(__name__)


class EngineManagerExtension:
    """
    Flask extension for managing SQLAlchemy engines in Superset.
    """

    def __init__(self) -> None:
        self.engine_manager: EngineManager | None = None

    def init_app(self, app: Flask) -> None:
        """
        Initialize the EngineManager with Flask app configuration.
        """
        engine_context_manager = app.config["ENGINE_CONTEXT_MANAGER"]
        db_connection_mutator = app.config["DB_CONNECTION_MUTATOR"]
        local_bind_address = app.config["SSH_TUNNEL_LOCAL_BIND_ADDRESS"]
        tunnel_timeout = timedelta(seconds=app.config["SSH_TUNNEL_TIMEOUT_SEC"])
        ssh_timeout = timedelta(seconds=app.config["SSH_TUNNEL_PACKET_TIMEOUT_SEC"])

        engine_manager_class: type[EngineManager] = load_class_from_name(
            app.config["ENGINE_MANAGER_CLASS"]
        )
        self.engine_manager = engine_manager_class(
            engine_context_manager,
            db_connection_mutator,
            local_bind_address,
            tunnel_timeout,
            ssh_timeout,
        )

        logger.info(
            "Initialized EngineManager with tunnel_timeout=%s, ssh_timeout=%s",
            tunnel_timeout.total_seconds(),
            ssh_timeout.total_seconds(),
        )

    @property
    def manager(self) -> EngineManager:
        """
        Get the EngineManager instance.

        Raises:
            RuntimeError: If the extension hasn't been initialized with an app.
        """
        if self.engine_manager is None:
            raise RuntimeError(
                "EngineManager extension not initialized. "
                "Call init_app() with a Flask app first."
            )
        return self.engine_manager
