# pylint: disable=too-few-public-methods

from typing import Any, Tuple

from sqlalchemy.engine.url import URL


class BaseDBConnectModifier:
    name = "BaseURLModifier"

    @classmethod
    def run(
        cls,
        sqlalchemy_url: URL,
        params: dict[str, Any],
        username: str,
        *args: Any,
        **kwargs: Any,
    ) -> Tuple[URL, dict[str, Any]]:
        raise NotImplementedError
