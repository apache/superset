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
from subprocess import Popen

import click
from colorama import Fore
from flask.cli import with_appcontext

from superset import app
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@click.option(
    "--workers", "-w", type=int, help="Number of celery server workers to fire up",
)
def worker(workers: int) -> None:
    """Starts a Superset worker for async SQL query execution."""
    logger.info(
        "The 'superset worker' command is deprecated. Please use the 'celery "
        "worker' command instead."
    )
    if workers:
        celery_app.conf.update(CELERYD_CONCURRENCY=workers)
    elif app.config["SUPERSET_CELERY_WORKERS"]:
        celery_app.conf.update(
            CELERYD_CONCURRENCY=app.config["SUPERSET_CELERY_WORKERS"]
        )

    local_worker = celery_app.Worker(optimization="fair")
    local_worker.start()


@click.command()
@with_appcontext
@click.option(
    "-p", "--port", default="5555", help="Port on which to start the Flower process",
)
@click.option(
    "-a", "--address", default="localhost", help="Address on which to run the service",
)
def flower(port: int, address: str) -> None:
    """Runs a Celery Flower web server

    Celery Flower is a UI to monitor the Celery operation on a given
    broker"""
    broker_url = celery_app.conf.BROKER_URL
    cmd = (
        "celery flower "
        f"--broker={broker_url} "
        f"--port={port} "
        f"--address={address} "
    )
    logger.info(
        "The 'superset flower' command is deprecated. Please use the 'celery "
        "flower' command instead."
    )
    print(Fore.GREEN + "Starting a Celery Flower instance")
    print(Fore.BLUE + "-=" * 40)
    print(Fore.YELLOW + cmd)
    print(Fore.BLUE + "-=" * 40)
    Popen(cmd, shell=True).wait()  # pylint: disable=consider-using-with
