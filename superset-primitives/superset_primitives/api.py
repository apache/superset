from typing import Type

from flask_appbuilder.api import BaseApi

from . import appbuilder


class RestApi(BaseApi):
    allow_browser_login = True


def add_api(api: Type[RestApi]) -> None:
    appbuilder.add_api(api)
