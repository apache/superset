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
from unittest import mock

from superset.sqllab.utils import bootstrap_sqllab_data


def test_bootstrap_sqllab_data_includes_non_ansi_identifier_quote() -> None:
    """
    The ``/api/v1/sqllab/`` bootstrap payload (backed by this function) must
    surface a database's dialect-specific identifier_quote characters, not
    just the ANSI default, since it seeds the initial autocomplete store
    before the async database-list fetch refreshes it.
    """
    database = mock.MagicMock()
    database.id = 1
    # `to_json()` (Flask-AppBuilder's column-based serializer) doesn't know
    # about the computed `engine_information` property, mirroring production:
    # `bootstrap_sqllab_data` falls back to `getattr(database, k)` for it.
    database.to_json.return_value = {}
    database.engine_information = {
        "supports_offset": True,
        "identifier_quote": {"start": "`", "end": "`"},
    }
    database.allows_virtual_table_explore = True

    with (
        mock.patch(
            "superset.sqllab.utils.DatabaseDAO.find_all", return_value=[database]
        ),
        mock.patch("superset.sqllab.utils.is_feature_enabled", return_value=False),
    ):
        result = bootstrap_sqllab_data(user_id=1)

    assert result["databases"][1]["engine_information"] == {
        "supports_offset": True,
        "identifier_quote": {"start": "`", "end": "`"},
    }
