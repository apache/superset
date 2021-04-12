from abc import ABC, abstractmethod

from flask import Flask
from sqlalchemy import TypeDecorator
from sqlalchemy_utils import EncryptedType


class AbstractEncryptedFieldAdapter(ABC):
    def __init__(self) -> None:
        super().__init__()

    @abstractmethod
    def create(self, *args, **kwargs):
        pass


class SQLAlchemyUtilsAdapter(AbstractEncryptedFieldAdapter):
    def create(self, *args, **kwargs):
        config = kwargs.pop("app_config")
        return EncryptedType(*args, config["SECRET_KEY"], **kwargs)


class EncryptedFieldFactory:
    def __init__(self) -> None:
        self._concrete_type_adapter = None
        self._config = None

    def init_app(self, app: Flask) -> None:
        self._config = app.config
        self._concrete_type_adapter = self._config[""]

    def create(self, *args, **kwargs) -> TypeDecorator:
        # Always pass the app config down to adapters
        kwargs["app_config"] = self._config

        return self._concrete_type_adapter(*args, **kwargs)
