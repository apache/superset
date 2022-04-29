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
# pylint: disable=unused-argument, import-outside-toplevel, unused-import, invalid-name

import copy

from sqlalchemy.orm.session import Session


def test_import_chart(app_context: None, session: Session) -> None:
    """
    Test importing a chart.
    """
    from superset.charts.commands.importers.v1.utils import import_chart
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from tests.integration_tests.fixtures.importexport import chart_config

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(session, config)
    assert chart.slice_name == "Deck Path"
    assert chart.viz_type == "deck_path"
    assert chart.is_managed_externally is False
    assert chart.external_url is None


def test_import_chart_managed_externally(app_context: None, session: Session) -> None:
    """
    Test importing a chart that is managed externally.
    """
    from superset.charts.commands.importers.v1.utils import import_chart
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from tests.integration_tests.fixtures.importexport import chart_config

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_chart"

    chart = import_chart(session, config)
    assert chart.is_managed_externally is True
    assert chart.external_url == "https://example.org/my_chart"
