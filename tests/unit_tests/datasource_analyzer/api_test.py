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

from superset.datasource_analyzer.api import DatasourceAnalyzerRestApi
from superset.datasource_analyzer.schemas import (
    DatasourceAnalyzerPostSchema,
    DatasourceAnalyzerResponseSchema,
)


def test_api_class_config() -> None:
    """Test API class configuration."""
    assert DatasourceAnalyzerRestApi.resource_name == "datasource_analyzer"
    assert DatasourceAnalyzerRestApi.class_permission_name == "DatasourceAnalyzer"
    assert DatasourceAnalyzerRestApi.allow_browser_login is True
    assert DatasourceAnalyzerRestApi.openapi_spec_tag == "Datasource Analyzer"


def test_api_openapi_schemas() -> None:
    """Test that OpenAPI schemas are registered."""
    schemas = DatasourceAnalyzerRestApi.openapi_spec_component_schemas

    assert DatasourceAnalyzerPostSchema in schemas
    assert DatasourceAnalyzerResponseSchema in schemas
