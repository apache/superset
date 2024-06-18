from typing import Any

from sqlalchemy.engine.url import URL


class BaseDBConnectModifier:
    name = "BaseURLModifier"

    @classmethod
    def run(cls, sqlalchemy_url: URL, params: dict[str, Any], username: str, *args: Any,
            **kwargs: Any) -> (URL, dict[str, Any]):
        raise NotImplementedError
