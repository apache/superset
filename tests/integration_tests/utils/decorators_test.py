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

import pytest

from superset import db, security_manager
from superset.commands.chart.fave import AddFavoriteChartCommand
from superset.commands.chart.unfave import DelFavoriteChartCommand
from superset.daos.chart import ChartDAO
from superset.models.slice import Slice
from superset.utils.core import override_user
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)


class TestTransactionDecorator(SupersetTestCase):
    """
    Test the transaction decorator.

    These tests were created because we use the `transaction` decorator to perform
    explicit commits in the code base. But because SQLAlchemy will autoflush by default,
    some tests where doing dirty reads, and failing to capture that data was actually
    not being written to the database.
    """

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_with_commit(self) -> None:
        """
        Test that the decorator commits.
        """
        example_chart = db.session.query(Slice).all()[0]
        assert example_chart is not None
        ids = ChartDAO.favorited_ids([example_chart])
        assert example_chart.id not in ids

        with override_user(security_manager.find_user("admin")):
            AddFavoriteChartCommand(example_chart.id).run()
            ids = ChartDAO.favorited_ids([example_chart])
            assert example_chart.id in ids

            DelFavoriteChartCommand(example_chart.id).run()
            ids = ChartDAO.favorited_ids([example_chart])
            assert example_chart.id not in ids

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_without_commit(self) -> None:
        """
        Test that autoflush is off.

        In this test we mock the `transaction` decorator so it doesn't autocommit. Since
        the integration tests are configured with autoflush off, we should not see the
        data in the same session.
        """
        with patch.object(db.session, "commit") as commit:
            example_chart = db.session.query(Slice).all()[0]
            assert example_chart is not None
            ids = ChartDAO.favorited_ids([example_chart])
            assert example_chart.id not in ids

            with override_user(security_manager.find_user("admin")):
                AddFavoriteChartCommand(example_chart.id).run()
                ids = ChartDAO.favorited_ids([example_chart])
                assert example_chart.id not in ids

            commit.assert_called()
