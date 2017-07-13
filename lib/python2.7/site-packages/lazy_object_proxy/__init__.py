try:
    import copy_reg as copyreg
except ImportError:
    import copyreg

from .utils import identity

copyreg.constructor(identity)

try:
    from .cext import Proxy
    from .cext import identity
except ImportError:
    from .slots import Proxy
else:
    copyreg.constructor(identity)

__version__ = "1.3.1"

__all__ = "Proxy",
