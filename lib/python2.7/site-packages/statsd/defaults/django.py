from __future__ import absolute_import
from django.conf import settings

from statsd import defaults
from statsd.client import StatsClient


statsd = None

if statsd is None:
    host = getattr(settings, 'STATSD_HOST', defaults.HOST)
    port = getattr(settings, 'STATSD_PORT', defaults.PORT)
    prefix = getattr(settings, 'STATSD_PREFIX', defaults.PREFIX)
    maxudpsize = getattr(settings, 'STATSD_MAXUDPSIZE', defaults.MAXUDPSIZE)
    ipv6 = getattr(settings, 'STATSD_IPV6', defaults.IPV6)
    statsd = StatsClient(host=host, port=port, prefix=prefix,
                         maxudpsize=maxudpsize, ipv6=ipv6)
