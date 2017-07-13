# pylint: disable=missing-docstring,too-few-public-methods

from typing import Dict, NamedTuple, NewType, Set

UserId = NewType('UserId', str)  # pylint: disable=invalid-name
PlaceId = NewType('PlaceId', str)  # pylint: disable=invalid-name


class Bar(NamedTuple):
    place: PlaceId
    name: str


class Foo(NamedTuple):
    user: Dict[UserId, Set[Bar]]
