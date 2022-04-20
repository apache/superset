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
"""Compatibility layer for different database engines

This modules stores logic specific to different database engines. Things
like time-related functions that are similar but not identical, or
information as to expose certain features or not and how to expose them.

For instance, Hive/Presto supports partitions and have a specific API to
list partitions. Other databases like Vertica also support partitions but
have different API to get to them. Other databases don't support partitions
at all. The classes here will use a common interface to specify all this.

The general idea is to use static classes and an inheritance scheme.
"""
import inspect
import logging
import pkgutil
from collections import defaultdict
from importlib import import_module
from pathlib import Path
from typing import Any, Dict, List, Set, Type

import sqlalchemy.databases
import sqlalchemy.dialects
from pkg_resources import iter_entry_points
from sqlalchemy.engine.default import DefaultDialect

from superset.db_engine_specs.base import BaseEngineSpec

logger = logging.getLogger(__name__)


def is_engine_spec(attr: Any) -> bool:
    return (
        inspect.isclass(attr)
        and issubclass(attr, BaseEngineSpec)
        and attr != BaseEngineSpec
    )


def load_engine_specs() -> List[Type[BaseEngineSpec]]:
    engine_specs: List[Type[BaseEngineSpec]] = []

    # load standard engines
    db_engine_spec_dir = str(Path(__file__).parent)
    for module_info in pkgutil.iter_modules([db_engine_spec_dir], prefix="."):
        module = import_module(module_info.name, package=__name__)
        engine_specs.extend(
            getattr(module, attr)
            for attr in module.__dict__
            if is_engine_spec(getattr(module, attr))
        )

    # load additional engines from external modules
    for ep in iter_entry_points("superset.db_engine_specs"):
        try:
            engine_spec = ep.load()
        except Exception:  # pylint: disable=broad-except
            logger.warning("Unable to load Superset DB engine spec: %s", engine_spec)
            continue
        engine_specs.append(engine_spec)

    return engine_specs


def get_engine_specs() -> Dict[str, Type[BaseEngineSpec]]:
    engine_specs = load_engine_specs()

    # build map from name/alias -> spec
    engine_specs_map: Dict[str, Type[BaseEngineSpec]] = {}
    for engine_spec in engine_specs:
        names = [engine_spec.engine]
        if engine_spec.engine_aliases:
            names.extend(engine_spec.engine_aliases)

        for name in names:
            engine_specs_map[name] = engine_spec

    return engine_specs_map


# there's a mismatch between the dialect name reported by the driver in these
# libraries and the dialect name used in the URI
backend_replacements = {
    "drilldbapi": "drill",
    "exasol": "exa",
}


def get_available_engine_specs() -> Dict[Type[BaseEngineSpec], Set[str]]:
    """
    Return available engine specs and installed drivers for them.
    """
    drivers: Dict[str, Set[str]] = defaultdict(set)

    # native SQLAlchemy dialects
    for attr in sqlalchemy.databases.__all__:
        dialect = getattr(sqlalchemy.dialects, attr)
        for attribute in dialect.__dict__.values():
            if (
                hasattr(attribute, "dialect")
                and inspect.isclass(attribute.dialect)
                and issubclass(attribute.dialect, DefaultDialect)
                # adodbapi dialect is removed in SQLA 1.4 and doesn't implement the
                # `dbapi` method, hence needs to be ignored to avoid logging a warning
                and attribute.dialect.driver != "adodbapi"
            ):
                try:
                    attribute.dialect.dbapi()
                except ModuleNotFoundError:
                    continue
                except Exception as ex:  # pylint: disable=broad-except
                    logger.warning(
                        "Unable to load dialect %s: %s", attribute.dialect, ex
                    )
                    continue
                drivers[attr].add(attribute.dialect.driver)

    # installed 3rd-party dialects
    for ep in iter_entry_points("sqlalchemy.dialects"):
        try:
            dialect = ep.load()
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning("Unable to load SQLAlchemy dialect %s: %s", dialect, ex)
        else:
            backend = dialect.name
            if isinstance(backend, bytes):
                backend = backend.decode()
            backend = backend_replacements.get(backend, backend)

            driver = getattr(dialect, "driver", dialect.name)
            if isinstance(driver, bytes):
                driver = driver.decode()
            drivers[backend].add(driver)

    available_engines = {}
    for engine_spec in load_engine_specs():
        driver = drivers[engine_spec.engine]

        # lookup driver by engine aliases.
        if not driver and engine_spec.engine_aliases:
            for alias in engine_spec.engine_aliases:
                driver = drivers[alias]
                if driver:
                    break

        available_engines[engine_spec] = driver

    return available_engines
