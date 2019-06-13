from abc import ABC, abstractmethod
import json

from flask import current_app


class AbstractActionLogger(ABC):

    @abstractmethod
    def log(self, action, *args, **kwargs):
        pass

    @abstractmethod
    def log_wrapper(self, f, *args, **kwargs):
        pass

    @property
    def stats_logger(self):
        return current_app.config.get('STATS_LOGGER')


class DBActionLogger(AbstractActionLogger):

    def log(self, action, *args, **kwargs):
        from superset.models.core import Log

        records = kwargs.get('records', list())
        dashboard_id = kwargs.get('dashboard_id')
        slice_id = kwargs.get('slice_id')
        duration_ms = kwargs.get('duration_ms')
        referrer = kwargs.get('referrer')
        user_id = kwargs.get('user_id')

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

    def log_wrapper(self, f, *args, **kwargs):
        pass
