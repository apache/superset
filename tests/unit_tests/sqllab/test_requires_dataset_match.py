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

from unittest.mock import patch

from flask import current_app
from pytest_mock import MockerFixture

from superset.sqllab.utils import requires_dataset_match
from superset.sqllab.validators import CanAccessQueryValidatorImpl


def test_requires_dataset_match_defaults_to_true() -> None:
    """A missing config key keeps the dataset-match requirement on."""
    config = current_app.config
    original = config.pop("SQLLAB_REQUIRE_DATASET_MATCH", None)
    try:
        assert requires_dataset_match() is True
    finally:
        if original is not None:
            config["SQLLAB_REQUIRE_DATASET_MATCH"] = original


def test_requires_dataset_match_reads_config() -> None:
    """The helper follows SQLLAB_REQUIRE_DATASET_MATCH in either direction."""
    with patch.dict(current_app.config, {"SQLLAB_REQUIRE_DATASET_MATCH": False}):
        assert requires_dataset_match() is False
    with patch.dict(current_app.config, {"SQLLAB_REQUIRE_DATASET_MATCH": True}):
        assert requires_dataset_match() is True


def test_execute_validator_follows_config(mocker: MockerFixture) -> None:
    """SQL Lab execute uses the same flag as result fetch and export."""
    raise_for_access = mocker.patch(
        "superset.sqllab.validators.security_manager.raise_for_access"
    )
    query = mocker.MagicMock()

    with patch.dict(current_app.config, {"SQLLAB_REQUIRE_DATASET_MATCH": False}):
        CanAccessQueryValidatorImpl().validate(query, template_params={"a": 1})

    raise_for_access.assert_called_once_with(
        query=query,
        template_params={"a": 1},
        force_dataset_match=False,
    )


def test_query_raise_for_access_follows_config(mocker: MockerFixture) -> None:
    """Result fetch and export stay aligned with the execute-time check."""
    from superset.models.sql_lab import Query

    raise_for_access = mocker.patch(
        "superset.models.sql_lab.security_manager.raise_for_access"
    )
    query = Query(sql="SELECT 1")

    with patch.dict(current_app.config, {"SQLLAB_REQUIRE_DATASET_MATCH": False}):
        query.raise_for_access()

    raise_for_access.assert_called_once_with(query=query, force_dataset_match=False)
