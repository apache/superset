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
# pylint: disable=import-outside-toplevel


def register_sqla_event_listeners() -> None:
    import sqlalchemy as sqla

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import FavStar
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import (
        ChartUpdater,
        DashboardUpdater,
        DatasetUpdater,
        FavStarUpdater,
        QueryUpdater,
    )

    sqla.event.listen(SqlaTable, "after_insert", DatasetUpdater.after_insert)
    sqla.event.listen(SqlaTable, "after_update", DatasetUpdater.after_update)
    sqla.event.listen(SqlaTable, "after_delete", DatasetUpdater.after_delete)

    sqla.event.listen(Slice, "after_insert", ChartUpdater.after_insert)
    sqla.event.listen(Slice, "after_update", ChartUpdater.after_update)
    sqla.event.listen(Slice, "after_delete", ChartUpdater.after_delete)

    sqla.event.listen(Dashboard, "after_insert", DashboardUpdater.after_insert)
    sqla.event.listen(Dashboard, "after_update", DashboardUpdater.after_update)
    sqla.event.listen(Dashboard, "after_delete", DashboardUpdater.after_delete)

    sqla.event.listen(FavStar, "after_insert", FavStarUpdater.after_insert)
    sqla.event.listen(FavStar, "after_delete", FavStarUpdater.after_delete)

    sqla.event.listen(SavedQuery, "after_insert", QueryUpdater.after_insert)
    sqla.event.listen(SavedQuery, "after_update", QueryUpdater.after_update)
    sqla.event.listen(SavedQuery, "after_delete", QueryUpdater.after_delete)


def clear_sqla_event_listeners() -> None:
    import sqlalchemy as sqla

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import FavStar
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import (
        ChartUpdater,
        DashboardUpdater,
        DatasetUpdater,
        FavStarUpdater,
        QueryUpdater,
    )

    sqla.event.remove(SqlaTable, "after_insert", DatasetUpdater.after_insert)
    sqla.event.remove(SqlaTable, "after_update", DatasetUpdater.after_update)
    sqla.event.remove(SqlaTable, "after_delete", DatasetUpdater.after_delete)

    sqla.event.remove(Slice, "after_insert", ChartUpdater.after_insert)
    sqla.event.remove(Slice, "after_update", ChartUpdater.after_update)
    sqla.event.remove(Slice, "after_delete", ChartUpdater.after_delete)

    sqla.event.remove(Dashboard, "after_insert", DashboardUpdater.after_insert)
    sqla.event.remove(Dashboard, "after_update", DashboardUpdater.after_update)
    sqla.event.remove(Dashboard, "after_delete", DashboardUpdater.after_delete)

    sqla.event.remove(FavStar, "after_insert", FavStarUpdater.after_insert)
    sqla.event.remove(FavStar, "after_delete", FavStarUpdater.after_delete)

    sqla.event.remove(SavedQuery, "after_insert", QueryUpdater.after_insert)
    sqla.event.remove(SavedQuery, "after_update", QueryUpdater.after_update)
    sqla.event.remove(SavedQuery, "after_delete", QueryUpdater.after_delete)
