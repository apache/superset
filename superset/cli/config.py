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
"""Configuration introspection CLI commands."""

import re
from typing import Any

import click
import yaml
from flask.cli import with_appcontext

from superset import app


def serialize_config_value(value: Any) -> Any:
    """Serialize config values for YAML output, handling callables and objects."""
    if callable(value):
        name = value.__name__ if hasattr(value, "__name__") else repr(value)
        return f"<callable: {name}>"
    elif hasattr(value, "__module__") and hasattr(value, "__name__"):
        return f"<object: {value.__module__}.{value.__name__}>"
    elif isinstance(value, type):
        return f"<class: {value.__module__}.{value.__name__}>"
    else:
        try:
            # Try to serialize with yaml to check if it's serializable
            yaml.safe_dump(value)
            return value
        except yaml.YAMLError:
            return repr(value)


def get_config_source(key: str) -> str:
    """Determine where a config value comes from."""
    # Check if it's from superset_config.py user override
    try:
        import superset_config

        if hasattr(superset_config, key):
            return "superset_config.py"
    except ImportError:
        pass

    # Check if it's from environment variables
    env_key = f"SUPERSET__{key}"
    import os

    if env_key in os.environ:
        return f"environment ({env_key})"

    # Otherwise it's from defaults
    return "config_defaults.py"


@click.group()
def config() -> None:
    """Configuration introspection commands."""
    pass


@config.command()
@with_appcontext
@click.option("--filter", "-f", help="Filter config keys (regex pattern)")
@click.option(
    "--verbose", "-v", is_flag=True, help="Show source information for each key"
)
def show(filter: str, verbose: bool) -> None:
    """Show effective configuration as YAML."""
    config_dict = {}

    # Get actual config keys (not Flask Config methods)
    # Use app.config.keys() to get only the configuration values
    for key in app.config.keys():
        # Apply filter if provided
        if filter and not re.search(filter, key, re.IGNORECASE):
            continue

        value = app.config[key]
        serialized_value = serialize_config_value(value)

        if verbose:
            source = get_config_source(key)
            config_dict[key] = {"value": serialized_value, "source": source}
        else:
            config_dict[key] = serialized_value

    # Output as YAML
    print(yaml.dump(config_dict, default_flow_style=False, sort_keys=True))


@config.command()
@with_appcontext
@click.argument("key")
def get(key: str) -> None:
    """Get a specific configuration value."""
    if key not in app.config:
        click.echo(f"Configuration key '{key}' not found", err=True)
        return

    value = app.config[key]
    serialized_value = serialize_config_value(value)
    source = get_config_source(key)

    result = {key: {"value": serialized_value, "source": source}}

    print(yaml.dump(result, default_flow_style=False))
