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
from datetime import datetime
import functools
import json

from flask import current_app, g, request


class AbstractEventLogger(ABC):
    @abstractmethod
    def log(self, user_id, action, *args, **kwargs):
        pass

    def log_this(self, f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            user_id = None
            if g.user:
                user_id = g.user.get_id()
            d = request.form.to_dict() or {}

            # request parameters can overwrite post body
            request_params = request.args.to_dict()
            d.update(request_params)
            d.update(kwargs)

            slice_id = d.get("slice_id")
            dashboard_id = d.get("dashboard_id")

            try:
                slice_id = int(
                    slice_id or json.loads(d.get("form_data")).get("slice_id")
                )
            except (ValueError, TypeError):
                slice_id = 0

            self.stats_logger.incr(f.__name__)
            start_dttm = datetime.now()
            value = f(*args, **kwargs)
            duration_ms = (datetime.now() - start_dttm).total_seconds() * 1000

            # bulk insert
            try:
                explode_by = d.get("explode")
                records = json.loads(d.get(explode_by))
            except Exception:
                records = [d]

            referrer = request.referrer[:1000] if request.referrer else None

            self.log(
                user_id,
                f.__name__,
                records=records,
                dashboard_id=dashboard_id,
                slice_id=slice_id,
                duration_ms=duration_ms,
                referrer=referrer,
            )
            return value

        return wrapper

    @property
    def stats_logger(self):
        return current_app.config.get("STATS_LOGGER")


class DBEventLogger(AbstractEventLogger):
    def log(self, user_id, action, *args, **kwargs):
        from superset.models.core import Log

        records = kwargs.get("records", list())
        dashboard_id = kwargs.get("dashboard_id")
        slice_id = kwargs.get("slice_id")
        duration_ms = kwargs.get("duration_ms")
        referrer = kwargs.get("referrer")

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
                user_id=user_id,
            )
            logs.append(log)

        sesh = current_app.appbuilder.get_session
        sesh.bulk_save_objects(logs)
        sesh.commit()
