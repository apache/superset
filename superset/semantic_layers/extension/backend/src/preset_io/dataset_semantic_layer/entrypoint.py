# The @semantic_layer decorator on DatasetSemanticLayer handles registration
# automatically. This import triggers the decorator at extension load time.
from .layer import DatasetSemanticLayer  # noqa: F401
