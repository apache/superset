"""
Root conftest that patches the semantic_layer decorator before test collection.

The decorator in superset_core.semantic_layers.decorators is a placeholder that
raises NotImplementedError outside of a running Superset instance. We replace it
with a no-op passthrough so the decorated classes can be imported during tests.
"""

import superset_core.semantic_layers.decorators as _dec


def _noop_semantic_layer(**kwargs):
    """Return the class unchanged."""

    def wrapper(cls):
        return cls

    return wrapper


_dec.semantic_layer = _noop_semantic_layer
