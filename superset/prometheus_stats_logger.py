from superset.stats_logger import BaseStatsLogger
from typing import Optional

try:
    from werkzeug.middleware.dispatcher import DispatcherMiddleware
    from prometheus_client import make_wsgi_app, Counter, Gauge, Summary

    class PrometheusStatsLogger(BaseStatsLogger):
        def __init__(self, prefix: str = "superset") -> None:
            super().__init__(prefix)

            self._counter = Counter(
                f"{self.prefix}_counter",
                "Counter metric for Superset",
                labelnames=["key"],
            )

            self._gauge = Gauge(
                f"{self.prefix}_gauge",
                "Gauge metric for Superset",
                labelnames=["key"],
                multiprocess_mode="livesum",
            )

            self._summary = Summary(
                f"{self.prefix}_summary",
                f"Summary metric for Superset",
                labelnames=["key"],
            )

            self._user_activity = Counter(
                f"{self.prefix}_user_activity",
                "User activity counter",
                labelnames=["user_id", "action", "dashboard_id"],
            )

        def incr(self, key: str) -> None:
            self._counter.labels(key=key).inc()

        def user_activity(
            self, user_id: Optional[int], action: str, dashboard_id: Optional[int]
        ) -> None:
            self._user_activity.labels(
                user_id=user_id, action=action, dashboard_id=dashboard_id
            ).inc()

        def decr(self, key: str) -> None:
            raise NotImplementedError()

        def timing(self, key: str, value: float) -> None:
            self._summary.labels(key=key).observe(value)

        def gauge(self, key: str, value: float) -> None:
            self._gauge.labels(key=key).set(value)


except Exception:  # pylint: disable=broad-except
    pass
