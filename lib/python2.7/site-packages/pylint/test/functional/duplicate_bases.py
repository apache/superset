"""Test duplicate bases error."""
# pylint: disable=missing-docstring,too-few-public-methods,no-init


class Duplicates(str, str): # [duplicate-bases]
    pass


class Alpha(str):
    pass


class NotDuplicates(Alpha, str):
    """The error should not be emitted for this case, since the
    other same base comes from the ancestors."""
