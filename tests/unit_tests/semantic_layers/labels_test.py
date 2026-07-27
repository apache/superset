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

from unittest.mock import patch

from superset.semantic_layers import labels


def test_labels_feature_flag_off() -> None:
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        assert labels.dataset_label() == "Dataset"
        assert labels.dataset_label_lower() == "dataset"
        assert labels.datasets_label() == "Datasets"
        assert labels.datasets_label_lower() == "datasets"
        assert labels.database_label() == "Database"
        assert labels.database_label_lower() == "database"
        assert labels.databases_label() == "Databases"
        assert labels.databases_label_lower() == "databases"
        assert labels.database_connections_menu_label() == "Database Connections"


def test_labels_feature_flag_on() -> None:
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        return_value=True,
    ):
        assert labels.dataset_label() == "Datasource"
        assert labels.dataset_label_lower() == "datasource"
        assert labels.datasets_label() == "Datasources"
        assert labels.datasets_label_lower() == "datasources"
        assert labels.database_label() == "Data connection"
        assert labels.database_label_lower() == "data connection"
        assert labels.databases_label() == "Data connections"
        assert labels.databases_label_lower() == "data connections"
        assert labels.database_connections_menu_label() == "Data Connections"
