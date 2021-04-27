from typing import Any, Optional

from superset.exceptions import SupersetException


class NotAuthorizedObject:
    def __init__(self, what_not_authorized: str):
        self._what_not_authorized = what_not_authorized

    def __getattr__(self, item: Any) -> None:
        raise NotAuthorizedException(self._what_not_authorized)

    def __getitem__(self, item: Any) -> None:
        raise NotAuthorizedException(self._what_not_authorized)


class NotAuthorizedException(SupersetException):
    def __init__(
        self, what_not_authorized: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__(
            "The user is not authorized to " + what_not_authorized, exception
        )
