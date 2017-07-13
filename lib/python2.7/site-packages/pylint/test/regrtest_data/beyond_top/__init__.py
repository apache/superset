from ... import Something
from . import data
try:
    from ... import Lala
except ImportError:
    pass