"""Tests for loopvar-in-closure."""

__revision__ = 0


def bad_case():
    """Loop variable from dict comprehension."""
    return {x: lambda: x for x in range(10)}
