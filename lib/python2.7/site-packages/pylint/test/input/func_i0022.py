"""Deprecated suppression style."""

__revision__ = None

a = 1  # pylint: disable=invalid-name
b = 1  # pylint: disable-msg=invalid-name

# pylint: disable=invalid-name
c = 1
# pylint: enable=invalid-name

# pylint: disable-msg=invalid-name
d = 1
# pylint: enable-msg=invalid-name

# pylint: disable-msg=C0103
e = 1
# pylint: enable-msg=C0103

# pylint: disable=C0103
f = 1
# pylint: enable=C0103
