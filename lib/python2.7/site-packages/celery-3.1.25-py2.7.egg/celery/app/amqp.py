# -*- coding: utf-8 -*-
"""
    celery.app.amqp
    ~~~~~~~~~~~~~~~

    Sending and receiving messages using Kombu.

"""
from __future__ import absolute_import

import numbers

from datetime import timedelta
from weakref import WeakValueDictionary

from kombu import Connection, Consumer, Exchange, Producer, Queue
from kombu.common import Broadcast
from kombu.pools import ProducerPool
from kombu.utils import cached_property, uuid
from kombu.utils.encoding import safe_repr
from kombu.utils.functional import maybe_list

from celery import signals
from celery.five import items, string_t
from celery.utils.text import indent as textindent
from celery.utils.timeutils import to_utc

from . import app_or_default
from . import routes as _routes

__all__ = ['AMQP', 'Queues', 'TaskProducer', 'TaskConsumer']

#: earliest date supported by time.mktime.
INT_MIN = -2147483648

#: Human readable queue declaration.
QUEUE_FORMAT = """
.> {0.name:<16} exchange={0.exchange.name}({0.exchange.type}) \
key={0.routing_key}
"""


class Queues(dict):
    """Queue name⇒ declaration mapping.

    :param queues: Initial list/tuple or dict of queues.
    :keyword create_missing: By default any unknown queues will be
                             added automatically, but if disabled
                             the occurrence of unknown queues
                             in `wanted` will raise :exc:`KeyError`.
    :keyword ha_policy: Default HA policy for queues with none set.


    """
    #: If set, this is a subset of queues to consume from.
    #: The rest of the queues are then used for routing only.
    _consume_from = None

    def __init__(self, queues=None, default_exchange=None,
                 create_missing=True, ha_policy=None, autoexchange=None):
        dict.__init__(self)
        self.aliases = WeakValueDictionary()
        self.default_exchange = default_exchange
        self.create_missing = create_missing
        self.ha_policy = ha_policy
        self.autoexchange = Exchange if autoexchange is None else autoexchange
        if isinstance(queues, (tuple, list)):
            queues = dict((q.name, q) for q in queues)
        for name, q in items(queues or {}):
            self.add(q) if isinstance(q, Queue) else self.add_compat(name, **q)

    def __getitem__(self, name):
        try:
            return self.aliases[name]
        except KeyError:
            return dict.__getitem__(self, name)

    def __setitem__(self, name, queue):
        if self.default_exchange and (not queue.exchange or
                                      not queue.exchange.name):
            queue.exchange = self.default_exchange
        dict.__setitem__(self, name, queue)
        if queue.alias:
            self.aliases[queue.alias] = queue

    def __missing__(self, name):
        if self.create_missing:
            return self.add(self.new_missing(name))
        raise KeyError(name)

    def add(self, queue, **kwargs):
        """Add new queue.

        The first argument can either be a :class:`kombu.Queue` instance,
        or the name of a queue.  If the former the rest of the keyword
        arguments are ignored, and options are simply taken from the queue
        instance.

        :param queue: :class:`kombu.Queue` instance or name of the queue.
        :keyword exchange: (if named) specifies exchange name.
        :keyword routing_key: (if named) specifies binding key.
        :keyword exchange_type: (if named) specifies type of exchange.
        :keyword \*\*options: (if named) Additional declaration options.

        """
        if not isinstance(queue, Queue):
            return self.add_compat(queue, **kwargs)
        if self.ha_policy:
            if queue.queue_arguments is None:
                queue.queue_arguments = {}
            self._set_ha_policy(queue.queue_arguments)
        self[queue.name] = queue
        return queue

    def add_compat(self, name, **options):
        # docs used to use binding_key as routing key
        options.setdefault('routing_key', options.get('binding_key'))
        if options['routing_key'] is None:
            options['routing_key'] = name
        if self.ha_policy is not None:
            self._set_ha_policy(options.setdefault('queue_arguments', {}))
        q = self[name] = Queue.from_dict(name, **options)
        return q

    def _set_ha_policy(self, args):
        policy = self.ha_policy
        if isinstance(policy, (list, tuple)):
            return args.update({'x-ha-policy': 'nodes',
                                'x-ha-policy-params': list(policy)})
        args['x-ha-policy'] = policy

    def format(self, indent=0, indent_first=True):
        """Format routing table into string for log dumps."""
        active = self.consume_from
        if not active:
            return ''
        info = [QUEUE_FORMAT.strip().format(q)
                for _, q in sorted(items(active))]
        if indent_first:
            return textindent('\n'.join(info), indent)
        return info[0] + '\n' + textindent('\n'.join(info[1:]), indent)

    def select_add(self, queue, **kwargs):
        """Add new task queue that will be consumed from even when
        a subset has been selected using the :option:`-Q` option."""
        q = self.add(queue, **kwargs)
        if self._consume_from is not None:
            self._consume_from[q.name] = q
        return q

    def select(self, include):
        """Sets :attr:`consume_from` by selecting a subset of the
        currently defined queues.

        :param include: Names of queues to consume from.
                        Can be iterable or string.
        """
        if include:
            self._consume_from = dict((name, self[name])
                                      for name in maybe_list(include))
    select_subset = select  # XXX compat

    def deselect(self, exclude):
        """Deselect queues so that they will not be consumed from.

        :param exclude: Names of queues to avoid consuming from.
                        Can be iterable or string.

        """
        if exclude:
            exclude = maybe_list(exclude)
            if self._consume_from is None:
                # using selection
                return self.select(k for k in self if k not in exclude)
            # using all queues
            for queue in exclude:
                self._consume_from.pop(queue, None)
    select_remove = deselect  # XXX compat

    def new_missing(self, name):
        return Queue(name, self.autoexchange(name), name)

    @property
    def consume_from(self):
        if self._consume_from is not None:
            return self._consume_from
        return self


class TaskProducer(Producer):
    app = None
    auto_declare = False
    retry = False
    retry_policy = None
    utc = True
    event_dispatcher = None
    send_sent_event = False

    def __init__(self, channel=None, exchange=None, *args, **kwargs):
        self.retry = kwargs.pop('retry', self.retry)
        self.retry_policy = kwargs.pop('retry_policy',
                                       self.retry_policy or {})
        self.send_sent_event = kwargs.pop('send_sent_event',
                                          self.send_sent_event)
        exchange = exchange or self.exchange
        self.queues = self.app.amqp.queues  # shortcut
        self.default_queue = self.app.amqp.default_queue
        self._default_mode = self.app.conf.CELERY_DEFAULT_DELIVERY_MODE
        super(TaskProducer, self).__init__(channel, exchange, *args, **kwargs)

    def publish_task(self, task_name, task_args=None, task_kwargs=None,
                     countdown=None, eta=None, task_id=None, group_id=None,
                     taskset_id=None,  # compat alias to group_id
                     expires=None, exchange=None, exchange_type=None,
                     event_dispatcher=None, retry=None, retry_policy=None,
                     queue=None, now=None, retries=0, chord=None,
                     callbacks=None, errbacks=None, routing_key=None,
                     serializer=None, delivery_mode=None, compression=None,
                     reply_to=None, time_limit=None, soft_time_limit=None,
                     declare=None, headers=None,
                     send_before_publish=signals.before_task_publish.send,
                     before_receivers=signals.before_task_publish.receivers,
                     send_after_publish=signals.after_task_publish.send,
                     after_receivers=signals.after_task_publish.receivers,
                     send_task_sent=signals.task_sent.send,  # XXX deprecated
                     sent_receivers=signals.task_sent.receivers,
                     **kwargs):
        """Send task message."""
        retry = self.retry if retry is None else retry
        headers = {} if headers is None else headers

        qname = queue
        if queue is None and exchange is None:
            queue = self.default_queue
        if queue is not None:
            if isinstance(queue, string_t):
                qname, queue = queue, self.queues[queue]
            else:
                qname = queue.name
            exchange = exchange or queue.exchange.name
            routing_key = routing_key or queue.routing_key
        if declare is None and queue and not isinstance(queue, Broadcast):
            declare = [queue]
        if delivery_mode is None:
            delivery_mode = self._default_mode

        # merge default and custom policy
        retry = self.retry if retry is None else retry
        _rp = (dict(self.retry_policy, **retry_policy) if retry_policy
               else self.retry_policy)
        task_id = task_id or uuid()
        task_args = task_args or []
        task_kwargs = task_kwargs or {}
        if not isinstance(task_args, (list, tuple)):
            raise ValueError('task args must be a list or tuple')
        if not isinstance(task_kwargs, dict):
            raise ValueError('task kwargs must be a dictionary')
        if countdown:  # Convert countdown to ETA.
            self._verify_seconds(countdown, 'countdown')
            now = now or self.app.now()
            eta = now + timedelta(seconds=countdown)
            if self.utc:
                eta = to_utc(eta).astimezone(self.app.timezone)
        if isinstance(expires, numbers.Real):
            self._verify_seconds(expires, 'expires')
            now = now or self.app.now()
            expires = now + timedelta(seconds=expires)
            if self.utc:
                expires = to_utc(expires).astimezone(self.app.timezone)
        eta = eta and eta.isoformat()
        expires = expires and expires.isoformat()

        body = {
            'task': task_name,
            'id': task_id,
            'args': task_args,
            'kwargs': task_kwargs,
            'retries': retries or 0,
            'eta': eta,
            'expires': expires,
            'utc': self.utc,
            'callbacks': callbacks,
            'errbacks': errbacks,
            'timelimit': (time_limit, soft_time_limit),
            'taskset': group_id or taskset_id,
            'chord': chord,
        }

        if before_receivers:
            send_before_publish(
                sender=task_name, body=body,
                exchange=exchange,
                routing_key=routing_key,
                declare=declare,
                headers=headers,
                properties=kwargs,
                retry_policy=retry_policy,
            )

        self.publish(
            body,
            exchange=exchange, routing_key=routing_key,
            serializer=serializer or self.serializer,
            compression=compression or self.compression,
            headers=headers,
            retry=retry, retry_policy=_rp,
            reply_to=reply_to,
            correlation_id=task_id,
            delivery_mode=delivery_mode, declare=declare,
            **kwargs
        )

        if after_receivers:
            send_after_publish(sender=task_name, body=body,
                               exchange=exchange, routing_key=routing_key)

        if sent_receivers:  # XXX deprecated
            send_task_sent(sender=task_name, task_id=task_id,
                           task=task_name, args=task_args,
                           kwargs=task_kwargs, eta=eta,
                           taskset=group_id or taskset_id)
        if self.send_sent_event:
            evd = event_dispatcher or self.event_dispatcher
            exname = exchange or self.exchange
            if isinstance(exname, Exchange):
                exname = exname.name
            evd.publish(
                'task-sent',
                {
                    'uuid': task_id,
                    'name': task_name,
                    'args': safe_repr(task_args),
                    'kwargs': safe_repr(task_kwargs),
                    'retries': retries,
                    'eta': eta,
                    'expires': expires,
                    'queue': qname,
                    'exchange': exname,
                    'routing_key': routing_key,
                },
                self, retry=retry, retry_policy=retry_policy,
            )
        return task_id
    delay_task = publish_task   # XXX Compat

    def _verify_seconds(self, s, what):
        if s < INT_MIN:
            raise ValueError('%s is out of range: %r' % (what, s))
        return s

    @cached_property
    def event_dispatcher(self):
        # We call Dispatcher.publish with a custom producer
        # so don't need the dispatcher to be "enabled".
        return self.app.events.Dispatcher(enabled=False)


class TaskPublisher(TaskProducer):
    """Deprecated version of :class:`TaskProducer`."""

    def __init__(self, channel=None, exchange=None, *args, **kwargs):
        self.app = app_or_default(kwargs.pop('app', self.app))
        self.retry = kwargs.pop('retry', self.retry)
        self.retry_policy = kwargs.pop('retry_policy',
                                       self.retry_policy or {})
        exchange = exchange or self.exchange
        if not isinstance(exchange, Exchange):
            exchange = Exchange(exchange,
                                kwargs.pop('exchange_type', 'direct'))
        self.queues = self.app.amqp.queues  # shortcut
        super(TaskPublisher, self).__init__(channel, exchange, *args, **kwargs)


class TaskConsumer(Consumer):
    app = None

    def __init__(self, channel, queues=None, app=None, accept=None, **kw):
        self.app = app or self.app
        if accept is None:
            accept = self.app.conf.CELERY_ACCEPT_CONTENT
        super(TaskConsumer, self).__init__(
            channel,
            queues or list(self.app.amqp.queues.consume_from.values()),
            accept=accept,
            **kw
        )


class AMQP(object):
    Connection = Connection
    Consumer = Consumer

    #: compat alias to Connection
    BrokerConnection = Connection

    producer_cls = TaskProducer
    consumer_cls = TaskConsumer
    queues_cls = Queues

    #: Cached and prepared routing table.
    _rtable = None

    #: Underlying producer pool instance automatically
    #: set by the :attr:`producer_pool`.
    _producer_pool = None

    # Exchange class/function used when defining automatic queues.
    # E.g. you can use ``autoexchange = lambda n: None`` to use the
    # amqp default exchange, which is a shortcut to bypass routing
    # and instead send directly to the queue named in the routing key.
    autoexchange = None

    def __init__(self, app):
        self.app = app

    def flush_routes(self):
        self._rtable = _routes.prepare(self.app.conf.CELERY_ROUTES)

    def Queues(self, queues, create_missing=None, ha_policy=None,
               autoexchange=None):
        """Create new :class:`Queues` instance, using queue defaults
        from the current configuration."""
        conf = self.app.conf
        if create_missing is None:
            create_missing = conf.CELERY_CREATE_MISSING_QUEUES
        if ha_policy is None:
            ha_policy = conf.CELERY_QUEUE_HA_POLICY
        if not queues and conf.CELERY_DEFAULT_QUEUE:
            queues = (Queue(conf.CELERY_DEFAULT_QUEUE,
                            exchange=self.default_exchange,
                            routing_key=conf.CELERY_DEFAULT_ROUTING_KEY), )
        autoexchange = (self.autoexchange if autoexchange is None
                        else autoexchange)
        return self.queues_cls(
            queues, self.default_exchange, create_missing,
            ha_policy, autoexchange,
        )

    def Router(self, queues=None, create_missing=None):
        """Return the current task router."""
        return _routes.Router(self.routes, queues or self.queues,
                              self.app.either('CELERY_CREATE_MISSING_QUEUES',
                                              create_missing), app=self.app)

    @cached_property
    def TaskConsumer(self):
        """Return consumer configured to consume from the queues
        we are configured for (``app.amqp.queues.consume_from``)."""
        return self.app.subclass_with_self(self.consumer_cls,
                                           reverse='amqp.TaskConsumer')
    get_task_consumer = TaskConsumer  # XXX compat

    @cached_property
    def TaskProducer(self):
        """Return publisher used to send tasks.

        You should use `app.send_task` instead.

        """
        conf = self.app.conf
        return self.app.subclass_with_self(
            self.producer_cls,
            reverse='amqp.TaskProducer',
            exchange=self.default_exchange,
            routing_key=conf.CELERY_DEFAULT_ROUTING_KEY,
            serializer=conf.CELERY_TASK_SERIALIZER,
            compression=conf.CELERY_MESSAGE_COMPRESSION,
            retry=conf.CELERY_TASK_PUBLISH_RETRY,
            retry_policy=conf.CELERY_TASK_PUBLISH_RETRY_POLICY,
            send_sent_event=conf.CELERY_SEND_TASK_SENT_EVENT,
            utc=conf.CELERY_ENABLE_UTC,
        )
    TaskPublisher = TaskProducer  # compat

    @cached_property
    def default_queue(self):
        return self.queues[self.app.conf.CELERY_DEFAULT_QUEUE]

    @cached_property
    def queues(self):
        """Queue name⇒ declaration mapping."""
        return self.Queues(self.app.conf.CELERY_QUEUES)

    @queues.setter  # noqa
    def queues(self, queues):
        return self.Queues(queues)

    @property
    def routes(self):
        if self._rtable is None:
            self.flush_routes()
        return self._rtable

    @cached_property
    def router(self):
        return self.Router()

    @property
    def producer_pool(self):
        if self._producer_pool is None:
            self._producer_pool = ProducerPool(
                self.app.pool,
                limit=self.app.pool.limit,
                Producer=self.TaskProducer,
            )
        return self._producer_pool
    publisher_pool = producer_pool  # compat alias

    @cached_property
    def default_exchange(self):
        return Exchange(self.app.conf.CELERY_DEFAULT_EXCHANGE,
                        self.app.conf.CELERY_DEFAULT_EXCHANGE_TYPE)
