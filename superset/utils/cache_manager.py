from typing import Optional

from flask import Flask
from flask_caching import Cache


class CacheManager:
    def __init__(self) -> None:
        super().__init__()

        self._tables_cache = None
        self._cache = None

    def init_app(self, app):
        self._cache = self._setup_cache(app, app.config.get("CACHE_CONFIG"))
        self._tables_cache = self._setup_cache(
            app, app.config.get("TABLE_NAMES_CACHE_CONFIG")
        )

    @staticmethod
    def _setup_cache(app: Flask, cache_config) -> Optional[Cache]:
        """Setup the flask-cache on a flask app"""
        if cache_config:
            if isinstance(cache_config, dict):
                if cache_config.get("CACHE_TYPE") != "null":
                    return Cache(app, config=cache_config)
            else:
                # Accepts a custom cache initialization function,
                # returning an object compatible with Flask-Caching API
                return cache_config(app)

        return None

    @property
    def tables_cache(self):
        return self._tables_cache

    @property
    def cache(self):
        return self._cache
