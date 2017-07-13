from __future__ import absolute_import
import os

from statsd import defaults
from statsd.client import StatsClient


statsd = None

if statsd is None:
    host = os.getenv('STATSD_HOST', defaults.HOST)
    port = int(os.getenv('STATSD_PORT', defaults.PORT))
    prefix = os.getenv('STATSD_PREFIX', defaults.PREFIX)
    maxudpsize = int(os.getenv('STATSD_MAXUDPSIZE', defaults.MAXUDPSIZE))
    ipv6 = bool(int(os.getenv('STATSD_IPV6', defaults.IPV6)))
    statsd = StatsClient(host=host, port=port, prefix=prefix,
                         maxudpsize=maxudpsize, ipv6=ipv6)
