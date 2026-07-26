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
# pylint: disable=import-outside-toplevel, unused-argument

import pytest
from pytest_mock import MockerFixture

from superset.utils import json

# A minimal unversioned dashboard export carrying an embedded dataset. The
# dataset object is enough to drive the datasets loop in ``import_dashboards``.
CONTENT_WITH_DATASET = json.dumps(
    {
        "datasources": [
            {
                "__SqlaTable__": {
                    "table_name": "sample_table",
                    "params": json.dumps({"remote_id": 1, "database_name": "main"}),
                }
            }
        ],
        "dashboards": [],
    }
)


def test_import_dashboards_requires_dataset_write(mocker: MockerFixture) -> None:
    """
    A user must hold dataset write permission to create/update the datasets
    embedded in a legacy dashboard export.
    """
    from superset import security_manager
    from superset.commands.dashboard.importers import v0
    from superset.commands.exceptions import ImportFailedError

    mocker.patch.object(v0, "get_user", return_value=object())
    can_access = mocker.patch.object(security_manager, "can_access", return_value=False)
    import_dataset = mocker.patch.object(v0, "import_dataset")

    with pytest.raises(ImportFailedError):
        v0.import_dashboards(CONTENT_WITH_DATASET)

    can_access.assert_called_once_with("can_write", "Dataset")
    import_dataset.assert_not_called()


def test_import_dashboards_allows_dataset_write(mocker: MockerFixture) -> None:
    """
    A user holding dataset write permission proceeds to import the datasets.
    """
    from superset import security_manager
    from superset.commands.dashboard.importers import v0

    mocker.patch.object(v0, "get_user", return_value=object())
    mocker.patch.object(security_manager, "can_access", return_value=True)
    import_dataset = mocker.patch.object(v0, "import_dataset", return_value=42)

    v0.import_dashboards(CONTENT_WITH_DATASET)

    import_dataset.assert_called_once()


def test_import_dashboards_skips_check_without_user(mocker: MockerFixture) -> None:
    """
    The command-line import paths run without a request user; the permission
    check is skipped so those paths keep working.
    """
    from superset import security_manager
    from superset.commands.dashboard.importers import v0

    mocker.patch.object(v0, "get_user", return_value=None)
    can_access = mocker.patch.object(security_manager, "can_access")
    import_dataset = mocker.patch.object(v0, "import_dataset", return_value=42)

    v0.import_dashboards(CONTENT_WITH_DATASET)

    can_access.assert_not_called()
    import_dataset.assert_called_once()
