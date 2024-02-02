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
from enum import Enum

import click
from click_option_group import optgroup, RequiredMutuallyExclusiveOptionGroup
from flask.cli import with_appcontext

from superset import db


class VizType(str, Enum):
    AREA = "area"
    BUBBLE = "bubble"
    DUAL_LINE = "dual_line"
    LINE = "line"
    PIVOT_TABLE = "pivot_table"
    SUNBURST = "sunburst"
    TREEMAP = "treemap"


@click.group()
def migrate_viz() -> None:
    """
    Migrate a viz from one type to another.
    """


@migrate_viz.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--viz_type",
    "-t",
    help=f"The viz type to migrate: {', '.join(list(VizType))}",
)
def upgrade(viz_type: str) -> None:
    """Upgrade a viz to the latest version."""
    migrate(VizType(viz_type))


@migrate_viz.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--viz_type",
    "-t",
    help=f"The viz type to migrate: {', '.join(list(VizType))}",
)
def downgrade(viz_type: str) -> None:
    """Downgrade a viz to the previous version."""
    migrate(VizType(viz_type), is_downgrade=True)


def migrate(viz_type: VizType, is_downgrade: bool = False) -> None:
    """Migrate a viz from one type to another."""
    # pylint: disable=import-outside-toplevel
    from superset.migrations.shared.migrate_viz.processors import (
        MigrateAreaChart,
        MigrateBubbleChart,
        MigrateDualLine,
        MigrateLineChart,
        MigratePivotTable,
        MigrateSunburst,
        MigrateTreeMap,
    )

    migrations = {
        VizType.AREA: MigrateAreaChart,
        VizType.BUBBLE: MigrateBubbleChart,
        VizType.DUAL_LINE: MigrateDualLine,
        VizType.LINE: MigrateLineChart,
        VizType.PIVOT_TABLE: MigratePivotTable,
        VizType.SUNBURST: MigrateSunburst,
        VizType.TREEMAP: MigrateTreeMap,
    }
    if is_downgrade:
        migrations[viz_type].downgrade(db.session)
    else:
        migrations[viz_type].upgrade(db.session)
