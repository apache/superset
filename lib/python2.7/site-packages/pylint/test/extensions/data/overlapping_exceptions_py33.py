# pylint: disable=missing-docstring

import socket

try:
    pass
except (IOError, OSError): # [overlapping-except]
    pass

try:
    pass
except (socket.error, OSError): # [overlapping-except]
    pass

try:
    pass
except (ConnectionError, socket.error): # [overlapping-except]
    pass
