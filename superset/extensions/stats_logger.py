from flask import Flask

from superset.stats_logger import BaseStatsLogger


class BaseStatsLoggerManager:
    def __init__(self) -> None:
        self._stats_logger = BaseStatsLogger()

    def init_app(self, app: Flask) -> None:
        self._stats_logger = app.config["STATS_LOGGER"]

    @property
    def instance(self) -> BaseStatsLogger:
        return self._stats_logger
