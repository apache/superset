from __future__ import absolute_import

import sys
import json
import socket
import logging
import numbers

from tornado import ioloop
from tornado import gen
from tornado import httpclient


try:
    from urllib.parse import urlparse, urljoin, quote, unquote
except ImportError:
    from urlparse import urlparse, urljoin
    from urllib import quote, unquote


try:
    import redis
except ImportError:
    redis = None


logger = logging.getLogger(__name__)


class BrokerBase(object):
    def __init__(self, broker_url, *args, **kwargs):
        purl = urlparse(broker_url)
        self.host = purl.hostname
        self.port = purl.port
        self.vhost = purl.path[1:]

        username = purl.username
        password = purl.password

        self.username = unquote(username) if username else username
        self.password = unquote(password) if password else password

    def queues(self, names):
        raise NotImplementedError


class RabbitMQ(BrokerBase):
    def __init__(self, broker_url, http_api, io_loop=None, **kwargs):
        super(RabbitMQ, self).__init__(broker_url)
        self.io_loop = io_loop or ioloop.IOLoop.instance()

        self.host = self.host or 'localhost'
        self.port = 15672
        self.vhost = quote(self.vhost, '') or '/'
        self.username = self.username or 'guest'
        self.password = self.password or 'guest'

        if not http_api:
            http_api = "http://{0}:{1}@{2}:15672/api/{3}".format(
                self.username, self.password, self.host, self.vhost)

        self.validate_http_api(http_api)
        self.http_api = http_api

    @gen.coroutine
    def queues(self, names):
        url = urljoin(self.http_api, 'queues/' + self.vhost)
        api_url = urlparse(self.http_api)
        username = unquote(api_url.username or '') or self.username
        password = unquote(api_url.password or '') or self.password

        http_client = httpclient.AsyncHTTPClient()
        try:
            response = yield http_client.fetch(
                url, auth_username=username, auth_password=password)
        except (socket.error, httpclient.HTTPError) as e:
            logger.error("RabbitMQ management API call failed: %s", e)
            logger.error("Make sure RabbitMQ Management Plugin is enabled "
                         "(rabbitmq-plugins enable rabbitmq_management)")
            raise gen.Return([])
        finally:
            http_client.close()

        if response.code == 200:
            info = json.loads(response.body.decode())
            raise gen.Return([x for x in info if x['name'] in names])
        else:
            response.rethrow()

    @classmethod
    def validate_http_api(cls, http_api):
        url = urlparse(http_api)
        if url.scheme not in ('http', 'https'):
            raise ValueError("Invalid http api schema: %s" % url.scheme)
        if not url.path.startswith('/api/'):
            raise ValueError("Invalid http api path: %s" % url.path)


DEFAULT_REDIS_PRIORITY_STEPS = [0, 3, 6, 9]


class Redis(BrokerBase):
    sep = '\x06\x16'

    def __init__(self, broker_url, *args, **kwargs):
        super(Redis, self).__init__(broker_url)
        self.host = self.host or 'localhost'
        self.port = self.port or 6379
        self.vhost = self._prepare_virtual_host(self.vhost)

        if not redis:
            raise ImportError('redis library is required')

        self.redis = redis.Redis(host=self.host, port=self.port,
                                 db=self.vhost, password=self.password)

        broker_options = kwargs.get('broker_options')

        if broker_options and 'priority_steps' in broker_options:
            self.priority_steps = broker_options['priority_steps']
        else:
            self.priority_steps = DEFAULT_REDIS_PRIORITY_STEPS

    def _q_for_pri(self, queue, pri):
        if pri not in self.priority_steps:
            raise ValueError('Priority not in priority steps')
        return '{0}{1}{2}'.format(*((queue, self.sep, pri) if pri else (queue, '', '')))

    @gen.coroutine
    def queues(self, names):
        queue_stats = []
        for name in names:
            priority_names = [self._q_for_pri(name, pri) for pri in self.priority_steps]
            queue_stats.append({
                'name': name,
                'messages': sum([self.redis.llen(x) for x in priority_names])
            })
        raise gen.Return(queue_stats)

    def _prepare_virtual_host(self, vhost):
        if not isinstance(vhost, numbers.Integral):
            if not vhost or vhost == '/':
                vhost = 0
            elif vhost.startswith('/'):
                vhost = vhost[1:]
            try:
                vhost = int(vhost)
            except ValueError:
                raise ValueError(
                    'Database is int between 0 and limit - 1, not {0}'.format(
                        vhost,
                    ))
        return vhost


class Broker(object):
    def __new__(cls, broker_url, *args, **kwargs):
        scheme = urlparse(broker_url).scheme
        if scheme == 'amqp':
            return RabbitMQ(broker_url, *args, **kwargs)
        elif scheme == 'redis':
            return Redis(broker_url, *args, **kwargs)
        else:
            raise NotImplementedError


@gen.coroutine
def main():
    broker_url = sys.argv[1] if len(sys.argv) > 1 else 'amqp://'
    queue_name = sys.argv[2] if len(sys.argv) > 2 else 'celery'
    if len(sys.argv) > 3:
        http_api = sys.argv[3]
    else:
        http_api = 'http://guest:guest@localhost:15672/api/'

    broker = Broker(broker_url, http_api=http_api)
    queues = yield broker.queues([queue_name])
    if queues:
        print(queues)
    io_loop.stop()


if __name__ == "__main__":
    io_loop = ioloop.IOLoop.instance()
    io_loop.add_callback(main)
    io_loop.start()
