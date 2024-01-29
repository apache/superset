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

from celery.exceptions import CeleryError

from superset.exceptions import SupersetGenericErrorException
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


class StopAsyncChartJobCommand:  # pylint: disable=too-few-public-methods
    def __init__(self, job_id: str):
        self.job_id = job_id

    def run(self) -> None:
        logger.info("Revoking and terminating Celery task %s", self.job_id)
        try:
            celery_app.control.revoke(self.job_id, terminate=True)
        except CeleryError as ex:
            raise SupersetGenericErrorException(
                f"Failed to terminate task {self.job_id}"
            ) from ex
