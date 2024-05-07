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

"""
This is the main entrypoint used by Celery workers. As such,
it needs to call create_app() in order to initialize things properly
"""

from typing import Any

from celery.signals import task_postrun, worker_process_init

# Superset framework imports
from superset.app import create_app
from superset.extensions import db

# Init the Flask app / configure everything


@worker_process_init.connect
def reset_db_connection_pool(**kwargs: Any) -> None:  # pylint: disable=unused-argument
    flask_app = create_app()
    with flask_app.app_context():
        # https://docs.sqlalchemy.org/en/14/core/connections.html#engine-disposal
        db.engine.dispose()


@task_postrun.connect
def teardown(  # pylint: disable=unused-argument
    retval: Any,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    After each Celery task teardown the Flask-SQLAlchemy session.

    Note for non eagar requests Flask-SQLAlchemy will perform the teardown.

    :param retval: The return value of the task
    :see: https://docs.celeryq.dev/en/stable/userguide/signals.html#task-postrun
    :see: https://gist.github.com/twolfson/a1b329e9353f9b575131
    """
    flask_app = create_app()

    if flask_app.config.get("SQLALCHEMY_COMMIT_ON_TEARDOWN"):
        if not isinstance(retval, Exception):
            db.session.commit()

    if not flask_app.config.get("CELERY_ALWAYS_EAGER"):
        db.session.remove()
