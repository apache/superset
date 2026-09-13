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
from superset.db_engine_specs.solr import SolrEngineSpec


def test_solr_properties() -> None:
    assert SolrEngineSpec.engine == "solr"
    assert SolrEngineSpec.engine_name == "Apache Solr"
    assert SolrEngineSpec.allows_joins is False
    assert SolrEngineSpec.allows_subqueries is False


def test_solr_metadata() -> None:
    metadata = SolrEngineSpec.metadata
    assert "Apache Solr" in metadata["description"]
    assert metadata["logo"] == "apache-solr.png"
    assert "sqlalchemy-solr" in metadata["pypi_packages"]
    assert metadata["default_port"] == 8983
    assert "solr://" in metadata["connection_string"]


def test_time_grain_expressions() -> None:
    assert SolrEngineSpec._time_grain_expressions[None].format(col="ts") == "ts"
