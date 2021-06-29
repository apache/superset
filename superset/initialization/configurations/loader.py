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

from werkzeug.utils import import_string

from superset.utils.core import is_test

logger = logging.getLogger(__name__)

DEFAULT_SUPERSET_CONFIG_LOCATION_ENV_NAME = "SUPERSET_CONFIG"
DEFAULT_SUPERSET_CONFIG_LOCATION = "superset.config"
OVERRIDE_CONFIG_PATH_ENV_VAR = "SUPERSET_CONFIG_PATH"
DEFAULT_CONFIG_MODULE_NAME = "superset_config"


def load_default_config_module() -> ModuleType:
    config_module = os.environ.get(
        DEFAULT_SUPERSET_CONFIG_LOCATION_ENV_NAME, DEFAULT_SUPERSET_CONFIG_LOCATION
    )
    config: ModuleType = import_string(config_module)
    return config


def load_override_config_module() -> Union[Dict[Any, Any], ModuleType]:
    if OVERRIDE_CONFIG_PATH_ENV_VAR in os.environ:
        return _load_based_on_env_var()
    return _load_based_on_python_path()


def _load_based_on_env_var() -> Union[Dict[Any, Any], ModuleType]:
    # Explicitly import config module that is not necessarily in pythonpath; useful
    # for case where app is being executed via pex.
    cfg_path = os.environ[OVERRIDE_CONFIG_PATH_ENV_VAR]
    try:
        loader = importlib.machinery.SourceFileLoader(
            DEFAULT_CONFIG_MODULE_NAME, cfg_path
        )
        spec = importlib.util.spec_from_loader(DEFAULT_CONFIG_MODULE_NAME, loader)
        override_conf = importlib.util.module_from_spec(spec)
        sys.modules[DEFAULT_CONFIG_MODULE_NAME] = override_conf
        loader.exec_module(override_conf)
        print(f"Loaded your LOCAL configuration at [{cfg_path}]")
        return override_conf
    except Exception:
        logger.exception(
            "Failed to import config for %s=%s", OVERRIDE_CONFIG_PATH_ENV_VAR, cfg_path
        )
        raise


def _load_based_on_python_path() -> Union[Dict[Any, Any], ModuleType]:
    if importlib.util.find_spec("superset_config") and not is_test():
        try:
            import superset_config  # pylint: disable=import-error

            print(f"Loaded your LOCAL configuration at [{superset_config.__file__}]")
            return superset_config
        except Exception:
            logger.exception("Found but failed to import local superset_config")
            raise
    return {}
