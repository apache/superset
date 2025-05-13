from typing import Type

from flask_appbuilder.api import BaseApi

from . import appbuilder


class RestApi(BaseApi):
    allow_browser_login = True


def add_api(api: Type[RestApi]) -> None:
    view = appbuilder.add_api(api)
    appbuilder._add_permission(view, True)
