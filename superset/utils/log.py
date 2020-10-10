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
import functools
import inspect
import json
import logging
import textwrap
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Callable, cast, Optional, Type, Union

from flask import current_app, g, request
from sqlalchemy.exc import SQLAlchemyError

from superset.stats_logger import BaseStatsLogger


class AbstractEventLogger(ABC):
    @abstractmethod
    def log(
        self, user_id: Optional[int], action: str, *args: Any, **kwargs: Any
    ) -> None:
        pass

    def log_with_context(
        self,
        action: str,
        start_dttm: Optional[datetime] = None,
        duration_ms: Optional[Union[float, int]] = None,
        **kwargs: Any
    ) -> None:
        """
        Log an event while reading information from the request context.
        `kwargs` will be appended directly to the log payload.
        """
        if duration_ms is None and start_dttm is not None:
            duration_ms = (datetime.now() - start_dttm).total_seconds() * 1000

        from superset.views.core import get_form_data

        user_id = g.user.get_id() if hasattr(g, "user") and g.user else None
        payload = request.form.to_dict() or {}
        # request parameters can overwrite post body
        payload.update(request.args.to_dict())
        payload.update(kwargs)

        dashboard_id = payload.get("dashboard_id")

        if "form_data" in payload:
            form_data, _ = get_form_data()
            payload["form_data"] = form_data
            slice_id = form_data.get("slice_id")
        else:
            slice_id = payload.get("slice_id")

        try:
            slice_id = int(slice_id)  # type: ignore
        except (TypeError, ValueError):
            slice_id = 0

        self.stats_logger.incr(action)

        # bulk insert
        try:
            explode_by = payload.get("explode")
            records = json.loads(payload.get(explode_by))  # type: ignore
        except Exception:  # pylint: disable=broad-except
            records = [payload]

        referrer = request.referrer[:1000] if request.referrer else None

        self.log(
            user_id,
            action,
            records=records,
            dashboard_id=dashboard_id,
            slice_id=slice_id,
            duration_ms=duration_ms,
            referrer=referrer,
        )

    def log_this(self, f: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start_dttm = datetime.now()
            value = f(*args, **kwargs)
            self.log_with_context(f.__name__, start_dttm=start_dttm, **kwargs)
            return value

        return wrapper

    @property
    def stats_logger(self) -> BaseStatsLogger:
        return current_app.config["STATS_LOGGER"]


def get_event_logger_from_cfg_value(cfg_value: Any) -> AbstractEventLogger:
    """
    This function implements the deprecation of assignment
    of class objects to EVENT_LOGGER configuration, and validates
    type of configured loggers.

    The motivation for this method is to gracefully deprecate the ability to configure
    EVENT_LOGGER with a class type, in favor of preconfigured instances which may have
    required construction-time injection of proprietary or locally-defined dependencies.

    :param cfg_value: The configured EVENT_LOGGER value to be validated
    :return: if cfg_value is a class type, will return a new instance created using a
    default con
    """
    result: Any = cfg_value
    if inspect.isclass(cfg_value):
        logging.warning(
            textwrap.dedent(
                """
                In superset private config, EVENT_LOGGER has been assigned a class
                object. In order to accomodate pre-configured instances without a
                default constructor, assignment of a class is deprecated and may no
                longer work at some point in the future. Please assign an object
                instance of a type that implements
                superset.utils.log.AbstractEventLogger.
                """
            )
        )

        event_logger_type = cast(Type[Any], cfg_value)
        result = event_logger_type()

    # Verify that we have a valid logger impl
    if not isinstance(result, AbstractEventLogger):
        raise TypeError(
            "EVENT_LOGGER must be configured with a concrete instance"
            "of superset.utils.log.AbstractEventLogger."
        )

    logging.info("Configured event logger of type %s", type(result))
    return cast(AbstractEventLogger, result)


class DBEventLogger(AbstractEventLogger):
    """Event logger that commits logs to Superset DB"""

    def log(  # pylint: disable=too-many-locals
        self, user_id: Optional[int], action: str, *args: Any, **kwargs: Any
    ) -> None:
        from superset.models.core import Log

        records = kwargs.get("records", list())
        dashboard_id = kwargs.get("dashboard_id")
        slice_id = kwargs.get("slice_id")
        duration_ms = kwargs.get("duration_ms")
        referrer = kwargs.get("referrer")

        logs = list()
        for record in records:
            json_string: Optional[str]
            try:
                json_string = json.dumps(record)
            except Exception:  # pylint: disable=broad-except
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
        try:
            sesh = current_app.appbuilder.get_session
            sesh.bulk_save_objects(logs)
            sesh.commit()
        except SQLAlchemyError as ex:
            logging.error("DBEventLogger failed to log event(s)")
            logging.exception(ex)
