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
import os
from typing import Optional
from functools import wraps, lru_cache
from unittest.mock import patch

from flask import Flask
import sqlparse

from superset.initialization import SupersetAppInitializer

logger = logging.getLogger(__name__)

def auto_patch(mock_mapping):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            patches = []
            try:
                # Apply patches before executing the function
                for function_path, side_effect in mock_mapping.items():
                    patcher = patch(function_path, side_effect=side_effect)
                    patches.append(patcher.start())  # Start each patch

                # Execute the original function with patches in place
                return func(*args, **kwargs)
            finally:
                # Ensure patches are cleaned up after function execution
                for patcher in patches:
                    patcher.stop()

        return wrapper
    return decorator

# Getting original references to the to-be intercepted function before hand
# so as to avoid call recursion once the patch is done
orig_sqlparse_parse_func = sqlparse.parse
orig_sqlparse_format_func = sqlparse.format

@lru_cache(maxsize=100)
def cached_sqlparse_parse(*args, **kwargs):
    return orig_sqlparse_parse_func(*args, **kwargs)

# It will be useful to cache in case, original sqlparse.format function is
# used
# @lru_cache(maxsize=100)
def mock_sqlparse_format(sql, *args, **kwargs):
    # One can retain the sqlparse_format in case it is required for their use case.
    # value =  orig_sqlparse_format_func(sql, *args, **kwargs)
    value = sql
    return value

def mock_sqlparse_parse(*args, **kwargs):
    value = cached_sqlparse_parse(*args, **kwargs)
    return value

patch_map = {
    'sqlparse.format': mock_sqlparse_format,
    'sqlparse.parse': mock_sqlparse_parse
}


# Patch all respective original entities with it's counter part mock entities
@auto_patch(patch_map)
def create_app(superset_config_module: Optional[str] = None) -> Flask:
    app = SupersetApp(__name__)

    try:
        # Allow user to override our config completely
        config_module = superset_config_module or os.environ.get(
            "SUPERSET_CONFIG", "superset.config"
        )
        app.config.from_object(config_module)

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()

        return app

    # Make sure that bootstrap errors ALWAYS get logged
    except Exception as ex:
        logger.exception("Failed to create app")
        raise ex


class SupersetApp(Flask):
    pass
