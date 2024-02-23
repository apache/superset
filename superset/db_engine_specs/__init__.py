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
from typing import Any, Optional

import sqlalchemy.dialects
from importlib_metadata import entry_points
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.exc import NoSuchModuleError

from superset import app, feature_flag_manager
from superset.db_engine_specs.base import BaseEngineSpec

logger = logging.getLogger(__name__)


def is_engine_spec(obj: Any) -> bool:
    """
    Return true if a given object is a DB engine spec.
    """
    return (
        inspect.isclass(obj)
        and issubclass(obj, BaseEngineSpec)
        and obj != BaseEngineSpec
    )


def load_engine_specs() -> list[type[BaseEngineSpec]]:
    """
    Load all engine specs, native and 3rd party.
    """
    engine_specs: list[type[BaseEngineSpec]] = []

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
    for ep in entry_points(group="superset.db_engine_specs"):
        try:
            engine_spec = ep.load()
        except Exception:  # pylint: disable=broad-except
            logger.warning("Unable to load Superset DB engine spec: %s", ep.name)
            continue
        engine_specs.append(engine_spec)

    return engine_specs


def get_engine_spec(backend: str, driver: Optional[str] = None) -> type[BaseEngineSpec]:
    """
    Return the DB engine spec associated with a given SQLAlchemy URL.

    Note that if a driver is not specified the function returns the first DB engine spec
    that supports the backend. Also, if a driver is specified but no DB engine explicitly
    supporting that driver exists then a backend-only match is done, in order to allow new
    drivers to work with Superset even if they are not listed in the DB engine spec
    drivers.
    """
    engine_specs = load_engine_specs()

    if driver is not None:
        for engine_spec in engine_specs:
            if engine_spec.supports_backend(backend, driver):
                return engine_spec

    # check ignoring the driver, in order to support new drivers; this will return a
    # random DB engine spec that supports the engine
    for engine_spec in engine_specs:
        if engine_spec.supports_backend(backend):
            return engine_spec

    # default to the generic DB engine spec
    return BaseEngineSpec


# there's a mismatch between the dialect name reported by the driver in these
# libraries and the dialect name used in the URI
backend_replacements = {
    "drilldbapi": "drill",
    "exasol": "exa",
}


# pylint: disable=too-many-branches
def get_available_engine_specs() -> dict[type[BaseEngineSpec], set[str]]:
    """
    Return available engine specs and installed drivers for them.
    """
    drivers: dict[str, set[str]] = defaultdict(set)

    # native SQLAlchemy dialects
    for attr in sqlalchemy.dialects.__all__:
        try:
            dialect = sqlalchemy.dialects.registry.load(attr)
            if (
                issubclass(dialect, DefaultDialect)
                and hasattr(dialect, "driver")
                # adodbapi dialect is removed in SQLA 1.4 and doesn't implement the
                # `dbapi` method, hence needs to be ignored to avoid logging a warning
                and dialect.driver != "adodbapi"
            ):
                try:
                    dialect.dbapi()
                except ModuleNotFoundError:
                    continue
                except Exception as ex:  # pylint: disable=broad-except
                    logger.warning("Unable to load dialect %s: %s", dialect, ex)
                    continue
                drivers[attr].add(dialect.driver)
        except NoSuchModuleError:
            continue

    # installed 3rd-party dialects
    for ep in entry_points(group="sqlalchemy.dialects"):
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

    dbs_denylist = app.config["DBS_AVAILABLE_DENYLIST"]
    if not feature_flag_manager.is_feature_enabled("ENABLE_SUPERSET_META_DB"):
        dbs_denylist["superset"] = {""}
    dbs_denylist_engines = dbs_denylist.keys()
    available_engines = {}

    for engine_spec in load_engine_specs():
        driver = drivers[engine_spec.engine]
        if (
            engine_spec.engine in dbs_denylist_engines
            and hasattr(engine_spec, "default_driver")
            and engine_spec.default_driver in dbs_denylist[engine_spec.engine]
        ):
            # do not add denied db engine specs to available list
            continue

        # lookup driver by engine aliases.
        if not driver and engine_spec.engine_aliases:
            for alias in engine_spec.engine_aliases:
                driver = drivers[alias]
                if driver:
                    break

        available_engines[engine_spec] = driver

    return available_engines
