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
from __future__ import annotations

import functools
import inspect
import json
import logging
import textwrap
from abc import ABC, abstractmethod
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import (
    Any,
    Callable,
    cast,
    Dict,
    Iterator,
    Optional,
    Type,
    TYPE_CHECKING,
    Union,
)

from flask import current_app, g, request
from flask_appbuilder.const import API_URI_RIS_KEY
from sqlalchemy.exc import SQLAlchemyError
from typing_extensions import Literal

if TYPE_CHECKING:
    from superset.stats_logger import BaseStatsLogger


def collect_request_payload() -> Dict[str, Any]:
    """Collect log payload identifiable from request context"""
    if not request:
        return {}

    payload: Dict[str, Any] = {
        "path": request.path,
        **request.form.to_dict(),
        # url search params can overwrite POST body
        **request.args.to_dict(),
    }

    # save URL match pattern in addition to the request path
    url_rule = str(request.url_rule)
    if url_rule != request.path:
        payload["url_rule"] = url_rule

    # remove rison raw string (q=xxx in search params) in favor of
    # rison object (could come from `payload_override`)
    if "rison" in payload and API_URI_RIS_KEY in payload:
        del payload[API_URI_RIS_KEY]
    # delete empty rison object
    if "rison" in payload and not payload["rison"]:
        del payload["rison"]

    return payload


class AbstractEventLogger(ABC):
    def __call__(
        self,
        action: str,
        object_ref: Optional[str] = None,
        log_to_statsd: bool = True,
        duration: Optional[timedelta] = None,
        **payload_override: Dict[str, Any],
    ) -> object:
        # pylint: disable=W0201
        self.action = action
        self.object_ref = object_ref
        self.log_to_statsd = log_to_statsd
        self.payload_override = payload_override
        return self

    def __enter__(self) -> None:
        # pylint: disable=W0201
        self.start = datetime.now()

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        # Log data w/ arguments being passed in
        self.log_with_context(
            action=self.action,
            object_ref=self.object_ref,
            log_to_statsd=self.log_to_statsd,
            duration=datetime.now() - self.start,
            **self.payload_override,
        )

    @abstractmethod
    def log(  # pylint: disable=too-many-arguments
        self,
        user_id: Optional[int],
        action: str,
        dashboard_id: Optional[int],
        duration_ms: Optional[int],
        slice_id: Optional[int],
        referrer: Optional[str],
        *args: Any,
        **kwargs: Any,
    ) -> None:
        pass

    def log_with_context(  # pylint: disable=too-many-locals
        self,
        action: str,
        duration: Optional[timedelta] = None,
        object_ref: Optional[str] = None,
        log_to_statsd: bool = True,
        **payload_override: Optional[Dict[str, Any]],
    ) -> None:
        # pylint: disable=import-outside-toplevel
        from superset.views.core import get_form_data

        referrer = request.referrer[:1000] if request and request.referrer else None

        duration_ms = int(duration.total_seconds() * 1000) if duration else None

        # Initial try and grab user_id via flask.g.user
        try:
            user_id = g.user.get_id()
        except Exception:  # pylint: disable=broad-except
            user_id = None

        # Whenever a user is not bounded to a session we
        # need to add them back before logging to capture user_id
        if user_id is None:
            try:
                session = current_app.appbuilder.get_session
                session.add(g.user)
                user_id = g.user.get_id()
            except Exception as ex:  # pylint: disable=broad-except
                logging.warning(ex)
                user_id = None

        payload = collect_request_payload()
        if object_ref:
            payload["object_ref"] = object_ref
        if payload_override:
            payload.update(payload_override)

        dashboard_id: Optional[int] = None
        try:
            dashboard_id = int(payload.get("dashboard_id"))  # type: ignore
        except (TypeError, ValueError):
            dashboard_id = None

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

        if log_to_statsd:
            self.stats_logger.incr(action)

        try:
            # bulk insert
            explode_by = payload.get("explode")
            records = json.loads(payload.get(explode_by))  # type: ignore
        except Exception:  # pylint: disable=broad-except
            records = [payload]

        self.log(
            user_id,
            action,
            records=records,
            dashboard_id=dashboard_id,
            slice_id=slice_id,
            duration_ms=duration_ms,
            referrer=referrer,
        )

    @contextmanager
    def log_context(
        self,
        action: str,
        object_ref: Optional[str] = None,
        log_to_statsd: bool = True,
    ) -> Iterator[Callable[..., None]]:
        """
        Log an event with additional information from the request context.
        :param action: a name to identify the event
        :param object_ref: reference to the Python object that triggered this action
        :param log_to_statsd: whether to update statsd counter for the action
        """
        payload_override = {}
        start = datetime.now()
        # yield a helper to add additional payload
        yield lambda **kwargs: payload_override.update(kwargs)
        duration = datetime.now() - start

        # take the action from payload_override else take the function param action
        action_str = payload_override.pop("action", action)
        self.log_with_context(
            action_str, duration, object_ref, log_to_statsd, **payload_override
        )

    def _wrapper(
        self,
        f: Callable[..., Any],
        action: Optional[Union[str, Callable[..., str]]] = None,
        object_ref: Optional[Union[str, Callable[..., str], Literal[False]]] = None,
        allow_extra_payload: Optional[bool] = False,
        **wrapper_kwargs: Any,
    ) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            action_str = (
                action(*args, **kwargs) if callable(action) else action
            ) or f.__name__
            object_ref_str = (
                object_ref(*args, **kwargs) if callable(object_ref) else object_ref
            ) or (f.__qualname__ if object_ref is not False else None)
            with self.log_context(
                action=action_str, object_ref=object_ref_str, **wrapper_kwargs
            ) as log:
                log(**kwargs)
                if allow_extra_payload:
                    # add a payload updater to the decorated function
                    value = f(*args, add_extra_log_payload=log, **kwargs)
                else:
                    value = f(*args, **kwargs)
            return value

        return wrapper

    def log_this(self, f: Callable[..., Any]) -> Callable[..., Any]:
        """Decorator that uses the function name as the action"""
        return self._wrapper(f)

    def log_this_with_context(self, **kwargs: Any) -> Callable[..., Any]:
        """Decorator that can override kwargs of log_context"""

        def func(f: Callable[..., Any]) -> Callable[..., Any]:
            return self._wrapper(f, **kwargs)

        return func

    def log_this_with_extra_payload(self, f: Callable[..., Any]) -> Callable[..., Any]:
        """Decorator that instrument `update_log_payload` to kwargs"""
        return self._wrapper(f, allow_extra_payload=True)

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

    def log(  # pylint: disable=too-many-arguments,too-many-locals
        self,
        user_id: Optional[int],
        action: str,
        dashboard_id: Optional[int],
        duration_ms: Optional[int],
        slice_id: Optional[int],
        referrer: Optional[str],
        *args: Any,
        **kwargs: Any,
    ) -> None:
        # pylint: disable=import-outside-toplevel
        from superset.models.core import Log

        records = kwargs.get("records", [])
        logs = []
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
