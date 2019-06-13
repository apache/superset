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
# pylint: disable=C,R,W
from abc import ABC, abstractmethod
import json

from flask import current_app


class AbstractActionLogger(ABC):

    @abstractmethod
    def log(self, user_id, action, *args, **kwargs):
        pass

    @property
    def stats_logger(self):
        return current_app.config.get('STATS_LOGGER')


class DBActionLogger(AbstractActionLogger):

    def log(self, user_id, action, *args, **kwargs):
        from superset.models.core import Log

        records = kwargs.get('records', list())
        dashboard_id = kwargs.get('dashboard_id')
        slice_id = kwargs.get('slice_id')
        duration_ms = kwargs.get('duration_ms')
        referrer = kwargs.get('referrer')

        logs = list()
        for record in records:
            try:
                json_string = json.dumps(record)
            except Exception:
                json_string = None
            log = Log(
                action=action,
                json=json_string,
                dashboard_id=dashboard_id,
                slice_id=slice_id,
                duration_ms=duration_ms,
                referrer=referrer,
                user_id=user_id)
            logs.append(log)

        sesh = current_app.appbuilder.get_session
        sesh.bulk_save_objects(logs)
        sesh.commit()
