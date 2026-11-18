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
"""Translate the public provider completeness signal at the provider boundary."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from superset_core.semantic_layers import errors as core_errors

from superset.exceptions import SemanticResultCompletenessError


@contextmanager
def provider_completeness() -> Iterator[None]:
    """
    Convert ``superset_core.semantic_layers.errors.SemanticResultCompletenessError``
    into the host's ``superset.exceptions.SemanticResultCompletenessError`` around
    a provider call. The two classes share a name, so refer to the core one only
    through its module.

    Host handlers, translated guidance and the client error status stay keyed on
    the host error. Providers that raise the host error directly are passed
    through unchanged.
    """
    try:
        yield
    except core_errors.SemanticResultCompletenessError as ex:
        raise SemanticResultCompletenessError(ex.reason) from ex
