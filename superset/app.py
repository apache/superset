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

import importlib.machinery
import importlib.util
import logging
import os
import sys
from types import ModuleType
from typing import Any, Dict, Union

from flask import Flask
from werkzeug.utils import import_string

from superset.initialization import SupersetAppInitializer
from superset.utils.core import is_test

logger = logging.getLogger(__name__)


def create_app() -> Flask:
    app = SupersetApp(__name__)

    try:
        # Allow user to override our config completely
        config = init_config()
        app.config.from_mapping(config)

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()

        return app

    # Make sure that bootstrap errors ALWAYS get logged
    except Exception as ex:
        logger.exception("Failed to create app")
        raise ex


def init_config() -> Dict[Any, Any]:
    config = convert_to_dict(load_default_config())
    override_conf = convert_to_dict(load_override_config())
    config.update(override_conf)
    return config


def convert_to_dict(module: Union[ModuleType, Dict[Any, Any]]) -> Dict[Any, Any]:
    raw_dict = module if isinstance(module, dict) else module.__dict__
    return {k: v for k, v in raw_dict.items() if k.isupper() and not k.startswith("_")}


def load_default_config() -> ModuleType:
    config_module = os.environ.get("SUPERSET_CONFIG", "superset.config")
    config: ModuleType = import_string(config_module)
    return config


def load_override_config() -> Union[Dict[Any, Any], ModuleType]:
    CONFIG_PATH_ENV_VAR = "SUPERSET_CONFIG_PATH"  # pylint: disable=C0103
    if CONFIG_PATH_ENV_VAR in os.environ:
        # Explicitly import config module that is not necessarily in pythonpath; useful
        # for case where app is being executed via pex.
        cfg_path = os.environ[CONFIG_PATH_ENV_VAR]
        try:
            CONFIG_MODULE_NAME = "superset_config"  # pylint: disable=C0103
            loader = importlib.machinery.SourceFileLoader(CONFIG_MODULE_NAME, cfg_path)
            spec = importlib.util.spec_from_loader(CONFIG_MODULE_NAME, loader)
            override_conf = importlib.util.module_from_spec(spec)
            sys.modules[CONFIG_MODULE_NAME] = override_conf
            loader.exec_module(override_conf)

            print(f"Loaded your LOCAL configuration at [{cfg_path}]")
            return override_conf
        except Exception:
            logger.exception(
                "Failed to import config for %s=%s", CONFIG_PATH_ENV_VAR, cfg_path
            )
            raise
    elif importlib.util.find_spec("superset_config") and not is_test():
        try:
            import superset_config  # pylint: disable=import-error

            print(f"Loaded your LOCAL configuration at [{superset_config.__file__}]")
            return superset_config
        except Exception:
            logger.exception("Found but failed to import local superset_config")
            raise
    return {}


class SupersetApp(Flask):
    pass
