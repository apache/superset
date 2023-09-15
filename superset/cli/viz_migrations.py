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


class VizTypes(str, Enum):
    TREEMAP = "treemap"
    DUAL_LINE = "dual_line"
    AREA = "area"
    PIVOT_TABLE = "pivot_table"


@click.group()
def viz_migrations() -> None:
    """
    Migrates a viz from one type to another.
    """


@viz_migrations.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--viz_type",
    "-t",
    help=f"The viz type to migrate: {', '.join(list(VizTypes))}",
)
def upgrade(viz_type: str) -> None:
    """Upgrade a viz to the latest version."""
    migrate_viz(VizTypes(viz_type))


@viz_migrations.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--viz_type",
    "-t",
    help=f"The viz type to migrate: {', '.join(list(VizTypes))}",
)
def downgrade(viz_type: str) -> None:
    """Downgrades a viz to the previous version."""
    migrate_viz(VizTypes(viz_type), is_downgrade=True)


def migrate_viz(viz_type: VizTypes, is_downgrade: bool = False) -> None:
    """Migrates a viz from one type to another."""
    # pylint: disable=import-outside-toplevel
    from superset.migrations.shared.migrate_viz.processors import (
        MigrateAreaChart,
        MigrateDualLine,
        MigratePivotTable,
        MigrateTreeMap,
    )

    migrations = {
        VizTypes.TREEMAP: MigrateTreeMap,
        VizTypes.DUAL_LINE: MigrateDualLine,
        VizTypes.AREA: MigrateAreaChart,
        VizTypes.PIVOT_TABLE: MigratePivotTable,
    }
    if is_downgrade:
        migrations[viz_type].downgrade()
    else:
        migrations[viz_type].upgrade()
