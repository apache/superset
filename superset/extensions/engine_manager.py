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
from typing import TYPE_CHECKING

from flask import Flask

from superset.engines.manager import EngineManager, EngineModes

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class EngineManagerExtension:
    """
    Flask extension for managing SQLAlchemy engines in Superset.

    This extension creates and configures an EngineManager instance based on
    Flask configuration, handling startup and shutdown of background cleanup
    threads as needed.
    """

    def __init__(self) -> None:
        self.engine_manager: EngineManager | None = None

    def init_app(self, app: Flask) -> None:
        """
        Initialize the EngineManager with Flask app configuration.
        """
        # Get configuration values with defaults
        mode_name = app.config.get("ENGINE_MANAGER_MODE", "NEW")
        cleanup_interval = app.config.get("ENGINE_MANAGER_CLEANUP_INTERVAL", 300.0)
        auto_start_cleanup = app.config.get("ENGINE_MANAGER_AUTO_START_CLEANUP", True)

        # Convert mode string to enum
        try:
            mode = EngineModes[mode_name.upper()]
        except KeyError:
            logger.warning(
                f"Invalid ENGINE_MANAGER_MODE '{mode_name}', defaulting to NEW"
            )
            mode = EngineModes.NEW

        # Create the engine manager
        self.engine_manager = EngineManager(
            mode=mode,
            cleanup_interval=cleanup_interval,
        )

        # Start cleanup thread if requested and in SINGLETON mode
        if auto_start_cleanup and mode == EngineModes.SINGLETON:
            self.engine_manager.start_cleanup_thread()
            logger.info("Started EngineManager cleanup thread")

        # Register shutdown handler
        def shutdown_engine_manager() -> None:
            if self.engine_manager:
                self.engine_manager.stop_cleanup_thread()
                logger.info("Stopped EngineManager cleanup thread")

        app.teardown_appcontext_funcs.append(lambda exc: None)

        # Register with atexit for clean shutdown
        import atexit

        atexit.register(shutdown_engine_manager)

        logger.info(
            f"Initialized EngineManager with mode={mode.name}, "
            f"cleanup_interval={cleanup_interval}s"
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
