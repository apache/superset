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


def test_import_dashboard(app_context: None, session: Session) -> None:
    """
    Test importing a dashboard.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.dashboards.commands.importers.v1.utils import import_dashboard
    from superset.models.core import Database
    from superset.models.slice import Slice
    from tests.integration_tests.fixtures.importexport import dashboard_config

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(dashboard_config)

    dashboard = import_dashboard(session, config)
    assert dashboard.dashboard_title == "Test dash"
    assert dashboard.description is None
    assert dashboard.is_managed_externally is False
    assert dashboard.external_url is None


def test_import_dashboard_managed_externally(
    app_context: None, session: Session
) -> None:
    """
    Test importing a dashboard that is managed externally.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.dashboards.commands.importers.v1.utils import import_dashboard
    from superset.models.core import Database
    from superset.models.slice import Slice
    from tests.integration_tests.fixtures.importexport import dashboard_config

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(dashboard_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_dashboard"

    dashboard = import_dashboard(session, config)
    assert dashboard.is_managed_externally is True
    assert dashboard.external_url == "https://example.org/my_dashboard"
