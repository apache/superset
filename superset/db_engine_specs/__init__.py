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
import pkgutil
from importlib import import_module
from pathlib import Path
from typing import Dict, Type

from superset.db_engine_specs.base import BaseEngineSpec

engines: Dict[str, Type[BaseEngineSpec]] = {}

for (_, name, _) in pkgutil.iter_modules([Path(__file__).parent]):  # type: ignore
    imported_module = import_module("." + name, package=__name__)

    for i in dir(imported_module):
        attribute = getattr(imported_module, i)

        if (
            inspect.isclass(attribute)
            and issubclass(attribute, BaseEngineSpec)
            and attribute.engine != ""
        ):
            engines[attribute.engine] = attribute
