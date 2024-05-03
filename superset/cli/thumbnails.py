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
import logging
from typing import Union

import click
from celery.utils.abstract import CallableTask
from flask.cli import with_appcontext

from superset.extensions import db

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@click.option(
    "--asynchronous",
    "-a",
    is_flag=True,
    default=False,
    help="Trigger commands to run remotely on a worker",
)
@click.option(
    "--dashboards_only",
    "-d",
    is_flag=True,
    default=False,
    help="Only process dashboards",
)
@click.option(
    "--charts_only",
    "-c",
    is_flag=True,
    default=False,
    help="Only process charts",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    default=False,
    help="Force refresh, even if previously cached",
)
@click.option("--model_id", "-i", multiple=True)
def compute_thumbnails(
    asynchronous: bool,
    dashboards_only: bool,
    charts_only: bool,
    force: bool,
    model_id: list[int],
) -> None:
    """Compute thumbnails"""
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks.thumbnails import (
        cache_chart_thumbnail,
        cache_dashboard_thumbnail,
    )

    def compute_generic_thumbnail(
        friendly_type: str,
        model_cls: Union[type[Dashboard], type[Slice]],
        model_ids: list[int],
        compute_func: CallableTask,
    ) -> None:
        query = db.session.query(model_cls)
        if model_ids:
            query = query.filter(model_cls.id.in_(model_ids))
        dashboards = query.all()
        count = len(dashboards)
        for i, model in enumerate(dashboards):
            if asynchronous:
                func = compute_func.delay
                action = "Triggering"
            else:
                func = compute_func
                action = "Processing"
            msg = f'{action} {friendly_type} "{model}" ({i+1}/{count})'
            click.secho(msg, fg="green")
            func(None, model.id, force=force)

    if not charts_only:
        compute_generic_thumbnail(
            "dashboard", Dashboard, model_id, cache_dashboard_thumbnail
        )
    if not dashboards_only:
        compute_generic_thumbnail("chart", Slice, model_id, cache_chart_thumbnail)
