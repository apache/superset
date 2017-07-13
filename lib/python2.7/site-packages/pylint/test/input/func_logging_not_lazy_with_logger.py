"""Logging warnings using a logger class."""
from __future__ import absolute_import
import logging

__revision__ = ''

LOG = logging.getLogger("domain")
LOG.debug("%s" % "junk")
LOG.log(logging.DEBUG, "%s" % "junk")
LOG2 = LOG.debug
LOG2("%s" % "junk")

logging.getLogger("domain").debug("%s" % "junk")
