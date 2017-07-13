# -*- coding: utf-8 -*-
"""
celery.worker.consumer
~~~~~~~~~~~~~~~~~~~~~~

This module contains the components responsible for consuming messages
from the broker, processing the messages and keeping the broker connections
up and running.

"""
from __future__ import absolute_import

import errno
import kombu
import logging
import os
import socket

from collections import defaultdict
from functools import partial
from heapq import heappush
from operator import itemgetter
from time import sleep

from billiard.common import restart_state
from billiard.exceptions import RestartFreqExceeded
from kombu.async.semaphore import DummyLock
from kombu.common import QoS, ignore_errors
from kombu.syn import _detect_environment
from kombu.utils.compat import get_errno
from kombu.utils.encoding import safe_repr, bytes_t
from kombu.utils.limits import TokenBucket

from celery import chain
from celery import bootsteps
from celery.app.trace import build_tracer
from celery.canvas import signature
from celery.exceptions import InvalidTaskError
from celery.five import items, values
from celery.utils.functional import noop
from celery.utils.log import get_logger
from celery.utils.objects import Bunch
from celery.utils.text import truncate
from celery.utils.timeutils import humanize_seconds, rate

from . import heartbeat, loops, pidbox
from .state import task_reserved, maybe_shutdown, revoked, reserved_requests

try:
    buffer_t = buffer
except NameError:  # pragma: no cover
    # Py3 does not have buffer, but we only need isinstance.

    class buffer_t(object):  # noqa
        pass

__all__ = [
    'Consumer', 'Connection', 'Events', 'Heart', 'Control',
    'Tasks', 'Evloop', 'Agent', 'Mingle', 'Gossip', 'dump_body',
]

CLOSE = bootsteps.CLOSE
logger = get_logger(__name__)
debug, info, warn, error, crit = (logger.debug, logger.info, logger.warning,
                                  logger.error, logger.critical)

CONNECTION_RETRY = """\
consumer: Connection to broker lost. \
Trying to re-establish the connection...\
"""

CONNECTION_RETRY_STEP = """\
Trying again {when}...\
"""

CONNECTION_ERROR = """\
consumer: Cannot connect to %s: %s.
%s
"""

CONNECTION_FAILOVER = """\
Will retry using next failover.\
"""

UNKNOWN_FORMAT = """\
Received and deleted unknown message. Wrong destination?!?

The full contents of the message body was: %s
"""

#: Error message for when an unregistered task is received.
UNKNOWN_TASK_ERROR = """\
Received unregistered task of type %s.
The message has been ignored and discarded.

Did you remember to import the module containing this task?
Or maybe you are using relative imports?
Please see http://bit.ly/gLye1c for more information.

The full contents of the message body was:
%s
"""

#: Error message for when an invalid task message is received.
INVALID_TASK_ERROR = """\
Received invalid task message: %s
The message has been ignored and discarded.

Please ensure your message conforms to the task
message protocol as described here: http://bit.ly/hYj41y

The full contents of the message body was:
%s
"""

MESSAGE_DECODE_ERROR = """\
Can't decode message body: %r [type:%r encoding:%r headers:%s]

body: %s
"""

MESSAGE_REPORT = """\
body: {0}
{{content_type:{1} content_encoding:{2}
  delivery_info:{3} headers={4}}}
"""

MINGLE_GET_FIELDS = itemgetter('clock', 'revoked')


def dump_body(m, body):
    if isinstance(body, buffer_t):
        body = bytes_t(body)
    return '{0} ({1}b)'.format(truncate(safe_repr(body), 1024),
                               len(m.body))


class Consumer(object):
    Strategies = dict

    #: set when consumer is shutting down.
    in_shutdown = False

    #: Optional callback called the first time the worker
    #: is ready to receive tasks.
    init_callback = None

    #: The current worker pool instance.
    pool = None

    #: A timer used for high-priority internal tasks, such
    #: as sending heartbeats.
    timer = None

    restart_count = -1  # first start is the same as a restart

    class Blueprint(bootsteps.Blueprint):
        name = 'Consumer'
        default_steps = [
            'celery.worker.consumer:Connection',
            'celery.worker.consumer:Mingle',
            'celery.worker.consumer:Events',
            'celery.worker.consumer:Gossip',
            'celery.worker.consumer:Heart',
            'celery.worker.consumer:Control',
            'celery.worker.consumer:Tasks',
            'celery.worker.consumer:Evloop',
            'celery.worker.consumer:Agent',
        ]

        def shutdown(self, parent):
            self.send_all(parent, 'shutdown')

    def __init__(self, on_task_request,
                 init_callback=noop, hostname=None,
                 pool=None, app=None,
                 timer=None, controller=None, hub=None, amqheartbeat=None,
                 worker_options=None, disable_rate_limits=False,
                 initial_prefetch_count=2, prefetch_multiplier=1, **kwargs):
        self.app = app
        self.controller = controller
        self.init_callback = init_callback
        self.hostname = hostname or socket.gethostname()
        self.pid = os.getpid()
        self.pool = pool
        self.timer = timer
        self.strategies = self.Strategies()
        conninfo = self.app.connection()
        self.connection_errors = conninfo.connection_errors
        self.channel_errors = conninfo.channel_errors
        self._restart_state = restart_state(maxR=5, maxT=1)

        self._does_info = logger.isEnabledFor(logging.INFO)
        self.on_task_request = on_task_request
        self.on_task_message = set()
        self.amqheartbeat_rate = self.app.conf.BROKER_HEARTBEAT_CHECKRATE
        self.disable_rate_limits = disable_rate_limits
        self.initial_prefetch_count = initial_prefetch_count
        self.prefetch_multiplier = prefetch_multiplier

        # this contains a tokenbucket for each task type by name, used for
        # rate limits, or None if rate limits are disabled for that task.
        self.task_buckets = defaultdict(lambda: None)
        self.reset_rate_limits()

        self.hub = hub
        if self.hub:
            self.amqheartbeat = amqheartbeat
            if self.amqheartbeat is None:
                self.amqheartbeat = self.app.conf.BROKER_HEARTBEAT
        else:
            self.amqheartbeat = 0

        if not hasattr(self, 'loop'):
            self.loop = loops.asynloop if hub else loops.synloop

        if _detect_environment() == 'gevent':
            # there's a gevent bug that causes timeouts to not be reset,
            # so if the connection timeout is exceeded once, it can NEVER
            # connect again.
            self.app.conf.BROKER_CONNECTION_TIMEOUT = None

        self.steps = []
        self.blueprint = self.Blueprint(
            app=self.app, on_close=self.on_close,
        )
        self.blueprint.apply(self, **dict(worker_options or {}, **kwargs))

    def bucket_for_task(self, type):
        limit = rate(getattr(type, 'rate_limit', None))
        return TokenBucket(limit, capacity=1) if limit else None

    def reset_rate_limits(self):
        self.task_buckets.update(
            (n, self.bucket_for_task(t)) for n, t in items(self.app.tasks)
        )

    def _update_prefetch_count(self, index=0):
        """Update prefetch count after pool/shrink grow operations.

        Index must be the change in number of processes as a positive
        (increasing) or negative (decreasing) number.

        .. note::

            Currently pool grow operations will end up with an offset
            of +1 if the initial size of the pool was 0 (e.g.
            ``--autoscale=1,0``).

        """
        num_processes = self.pool.num_processes
        if not self.initial_prefetch_count or not num_processes:
            return  # prefetch disabled
        self.initial_prefetch_count = (
            self.pool.num_processes * self.prefetch_multiplier
        )
        return self._update_qos_eventually(index)

    def _update_qos_eventually(self, index):
        return (self.qos.decrement_eventually if index < 0
                else self.qos.increment_eventually)(
            abs(index) * self.prefetch_multiplier)

    def _limit_task(self, request, bucket, tokens):
        if not bucket.can_consume(tokens):
            hold = bucket.expected_time(tokens)
            self.timer.call_after(
                hold, self._limit_task, (request, bucket, tokens),
            )
        else:
            task_reserved(request)
            self.on_task_request(request)

    def start(self):
        blueprint = self.blueprint
        while blueprint.state != CLOSE:
            self.restart_count += 1
            maybe_shutdown()
            try:
                blueprint.start(self)
            except self.connection_errors as exc:
                if isinstance(exc, OSError) and get_errno(exc) == errno.EMFILE:
                    raise  # Too many open files
                maybe_shutdown()
                try:
                    self._restart_state.step()
                except RestartFreqExceeded as exc:
                    crit('Frequent restarts detected: %r', exc, exc_info=1)
                    sleep(1)
                if blueprint.state != CLOSE and self.connection:
                    warn(CONNECTION_RETRY, exc_info=True)
                    try:
                        self.connection.collect()
                    except Exception:
                        pass
                    self.on_close()
                    blueprint.restart(self)

    def register_with_event_loop(self, hub):
        self.blueprint.send_all(
            self, 'register_with_event_loop', args=(hub, ),
            description='Hub.register',
        )

    def shutdown(self):
        self.in_shutdown = True
        self.blueprint.shutdown(self)

    def stop(self):
        self.blueprint.stop(self)

    def on_ready(self):
        callback, self.init_callback = self.init_callback, None
        if callback:
            callback(self)

    def loop_args(self):
        return (self, self.connection, self.task_consumer,
                self.blueprint, self.hub, self.qos, self.amqheartbeat,
                self.app.clock, self.amqheartbeat_rate)

    def on_decode_error(self, message, exc):
        """Callback called if an error occurs while decoding
        a message received.

        Simply logs the error and acknowledges the message so it
        doesn't enter a loop.

        :param message: The message with errors.
        :param exc: The original exception instance.

        """
        crit(MESSAGE_DECODE_ERROR,
             exc, message.content_type, message.content_encoding,
             safe_repr(message.headers), dump_body(message, message.body),
             exc_info=1)
        message.ack()

    def on_close(self):
        # Clear internal queues to get rid of old messages.
        # They can't be acked anyway, as a delivery tag is specific
        # to the current channel.
        if self.controller and self.controller.semaphore:
            self.controller.semaphore.clear()
        if self.timer:
            self.timer.clear()
        reserved_requests.clear()
        if self.pool and self.pool.flush:
            self.pool.flush()

    def connect(self):
        """Establish the broker connection.

        Will retry establishing the connection if the
        :setting:`BROKER_CONNECTION_RETRY` setting is enabled

        """
        conn = self.app.connection(heartbeat=self.amqheartbeat)

        # Callback called for each retry while the connection
        # can't be established.
        def _error_handler(exc, interval, next_step=CONNECTION_RETRY_STEP):
            if getattr(conn, 'alt', None) and interval == 0:
                next_step = CONNECTION_FAILOVER
            error(CONNECTION_ERROR, conn.as_uri(), exc,
                  next_step.format(when=humanize_seconds(interval, 'in', ' ')))

        # remember that the connection is lazy, it won't establish
        # until needed.
        if not self.app.conf.BROKER_CONNECTION_RETRY:
            # retry disabled, just call connect directly.
            conn.connect()
            return conn

        conn = conn.ensure_connection(
            _error_handler, self.app.conf.BROKER_CONNECTION_MAX_RETRIES,
            callback=maybe_shutdown,
        )
        if self.hub:
            conn.transport.register_with_event_loop(conn.connection, self.hub)
        return conn

    def add_task_queue(self, queue, exchange=None, exchange_type=None,
                       routing_key=None, **options):
        cset = self.task_consumer
        queues = self.app.amqp.queues
        # Must use in' here, as __missing__ will automatically
        # create queues when CELERY_CREATE_MISSING_QUEUES is enabled.
        # (Issue #1079)
        if queue in queues:
            q = queues[queue]
        else:
            exchange = queue if exchange is None else exchange
            exchange_type = ('direct' if exchange_type is None
                             else exchange_type)
            q = queues.select_add(queue,
                                  exchange=exchange,
                                  exchange_type=exchange_type,
                                  routing_key=routing_key, **options)
        if not cset.consuming_from(queue):
            cset.add_queue(q)
            cset.consume()
            info('Started consuming from %s', queue)

    def cancel_task_queue(self, queue):
        info('Canceling queue %s', queue)
        self.app.amqp.queues.deselect(queue)
        self.task_consumer.cancel_by_queue(queue)

    def apply_eta_task(self, task):
        """Method called by the timer to apply a task with an
        ETA/countdown."""
        task_reserved(task)
        self.on_task_request(task)
        self.qos.decrement_eventually()

    def _message_report(self, body, message):
        return MESSAGE_REPORT.format(dump_body(message, body),
                                     safe_repr(message.content_type),
                                     safe_repr(message.content_encoding),
                                     safe_repr(message.delivery_info),
                                     safe_repr(message.headers))

    def on_unknown_message(self, body, message):
        warn(UNKNOWN_FORMAT, self._message_report(body, message))
        message.reject_log_error(logger, self.connection_errors)

    def on_unknown_task(self, body, message, exc):
        error(UNKNOWN_TASK_ERROR, exc, dump_body(message, body), exc_info=True)
        message.reject_log_error(logger, self.connection_errors)

    def on_invalid_task(self, body, message, exc):
        error(INVALID_TASK_ERROR, exc, dump_body(message, body), exc_info=True)
        message.reject_log_error(logger, self.connection_errors)

    def update_strategies(self):
        loader = self.app.loader
        for name, task in items(self.app.tasks):
            self.strategies[name] = task.start_strategy(self.app, self)
            task.__trace__ = build_tracer(name, task, loader, self.hostname,
                                          app=self.app)

    def create_task_handler(self):
        strategies = self.strategies
        on_unknown_message = self.on_unknown_message
        on_unknown_task = self.on_unknown_task
        on_invalid_task = self.on_invalid_task
        callbacks = self.on_task_message

        def on_task_received(body, message):
            headers = message.headers
            try:
                type_, is_proto2 = headers['task'], 1
            except (KeyError, TypeError):
                try:
                    type_, is_proto2 = body['task'], 0
                except (KeyError, TypeError):
                    return on_unknown_message(body, message)

            if is_proto2:
                body = proto2_to_proto1(
                    self.app, type_, body, message, headers)

            try:
                strategies[type_](message, body,
                                  message.ack_log_error,
                                  message.reject_log_error,
                                  callbacks)
            except KeyError as exc:
                on_unknown_task(body, message, exc)
            except InvalidTaskError as exc:
                on_invalid_task(body, message, exc)

        return on_task_received

    def __repr__(self):
        return '<Consumer: {self.hostname} ({state})>'.format(
            self=self, state=self.blueprint.human_state(),
        )


def proto2_to_proto1(app, type_, body, message, headers):
    args, kwargs, embed = body
    embedded = _extract_proto2_embed(**embed)
    chained = embedded.pop('chain')
    new_body = dict(
        _extract_proto2_headers(type_, **headers),
        args=args,
        kwargs=kwargs,
        **embedded)
    if chained:
        new_body['callbacks'].append(chain(chained, app=app))
    return new_body


def _extract_proto2_headers(type_, id, retries, eta, expires,
                            group, timelimit, **_):
    return {
        'id': id,
        'task': type_,
        'retries': retries,
        'eta': eta,
        'expires': expires,
        'utc': True,
        'taskset': group,
        'timelimit': timelimit,
    }


def _extract_proto2_embed(callbacks, errbacks, chain, chord, **_):
    return {
        'callbacks': callbacks or [],
        'errbacks': errbacks,
        'chain': chain,
        'chord': chord,
    }


class Connection(bootsteps.StartStopStep):

    def __init__(self, c, **kwargs):
        c.connection = None

    def start(self, c):
        c.connection = c.connect()
        info('Connected to %s', c.connection.as_uri())

    def shutdown(self, c):
        # We must set self.connection to None here, so
        # that the green pidbox thread exits.
        connection, c.connection = c.connection, None
        if connection:
            ignore_errors(connection, connection.close)

    def info(self, c, params='N/A'):
        if c.connection:
            params = c.connection.info()
            params.pop('password', None)  # don't send password.
        return {'broker': params}


class Events(bootsteps.StartStopStep):
    requires = (Connection, )

    def __init__(self, c, send_events=None, **kwargs):
        self.send_events = True
        self.groups = None if send_events else ['worker']
        c.event_dispatcher = None

    def start(self, c):
        # flush events sent while connection was down.
        prev = self._close(c)
        dis = c.event_dispatcher = c.app.events.Dispatcher(
            c.connect(), hostname=c.hostname,
            enabled=self.send_events, groups=self.groups,
        )
        if prev:
            dis.extend_buffer(prev)
            dis.flush()

    def stop(self, c):
        pass

    def _close(self, c):
        if c.event_dispatcher:
            dispatcher = c.event_dispatcher
            # remember changes from remote control commands:
            self.groups = dispatcher.groups

            # close custom connection
            if dispatcher.connection:
                ignore_errors(c, dispatcher.connection.close)
            ignore_errors(c, dispatcher.close)
            c.event_dispatcher = None
            return dispatcher

    def shutdown(self, c):
        self._close(c)


class Heart(bootsteps.StartStopStep):
    requires = (Events, )

    def __init__(self, c, without_heartbeat=False, heartbeat_interval=None,
                 **kwargs):
        self.enabled = not without_heartbeat
        self.heartbeat_interval = heartbeat_interval
        c.heart = None

    def start(self, c):
        c.heart = heartbeat.Heart(
            c.timer, c.event_dispatcher, self.heartbeat_interval,
        )
        c.heart.start()

    def stop(self, c):
        c.heart = c.heart and c.heart.stop()
    shutdown = stop


class Mingle(bootsteps.StartStopStep):
    label = 'Mingle'
    requires = (Events, )
    compatible_transports = set(['amqp', 'redis'])

    def __init__(self, c, without_mingle=False, **kwargs):
        self.enabled = not without_mingle and self.compatible_transport(c.app)

    def compatible_transport(self, app):
        with app.connection() as conn:
            return conn.transport.driver_type in self.compatible_transports

    def start(self, c):
        info('mingle: searching for neighbors')
        I = c.app.control.inspect(timeout=1.0, connection=c.connection)
        replies = I.hello(c.hostname, revoked._data) or {}
        replies.pop(c.hostname, None)
        if replies:
            info('mingle: sync with %s nodes',
                 len([reply for reply, value in items(replies) if value]))
            for reply in values(replies):
                if reply:
                    try:
                        other_clock, other_revoked = MINGLE_GET_FIELDS(reply)
                    except KeyError:  # reply from pre-3.1 worker
                        pass
                    else:
                        c.app.clock.adjust(other_clock)
                        revoked.update(other_revoked)
            info('mingle: sync complete')
        else:
            info('mingle: all alone')


class Tasks(bootsteps.StartStopStep):
    requires = (Mingle, )

    def __init__(self, c, **kwargs):
        c.task_consumer = c.qos = None

    def start(self, c):
        c.update_strategies()

        # - RabbitMQ 3.3 completely redefines how basic_qos works..
        # This will detect if the new qos smenatics is in effect,
        # and if so make sure the 'apply_global' flag is set on qos updates.
        qos_global = not c.connection.qos_semantics_matches_spec

        # set initial prefetch count
        c.connection.default_channel.basic_qos(
            0, c.initial_prefetch_count, qos_global,
        )

        c.task_consumer = c.app.amqp.TaskConsumer(
            c.connection, on_decode_error=c.on_decode_error,
        )

        def set_prefetch_count(prefetch_count):
            return c.task_consumer.qos(
                prefetch_count=prefetch_count,
                apply_global=qos_global,
            )
        c.qos = QoS(set_prefetch_count, c.initial_prefetch_count)

    def stop(self, c):
        if c.task_consumer:
            debug('Canceling task consumer...')
            ignore_errors(c, c.task_consumer.cancel)

    def shutdown(self, c):
        if c.task_consumer:
            self.stop(c)
            debug('Closing consumer channel...')
            ignore_errors(c, c.task_consumer.close)
            c.task_consumer = None

    def info(self, c):
        return {'prefetch_count': c.qos.value if c.qos else 'N/A'}


class Agent(bootsteps.StartStopStep):
    conditional = True
    requires = (Connection, )

    def __init__(self, c, **kwargs):
        self.agent_cls = self.enabled = c.app.conf.CELERYD_AGENT

    def create(self, c):
        agent = c.agent = self.instantiate(self.agent_cls, c.connection)
        return agent


class Control(bootsteps.StartStopStep):
    requires = (Tasks, )

    def __init__(self, c, **kwargs):
        self.is_green = c.pool is not None and c.pool.is_green
        self.box = (pidbox.gPidbox if self.is_green else pidbox.Pidbox)(c)
        self.start = self.box.start
        self.stop = self.box.stop
        self.shutdown = self.box.shutdown

    def include_if(self, c):
        return c.app.conf.CELERY_ENABLE_REMOTE_CONTROL


class Gossip(bootsteps.ConsumerStep):
    label = 'Gossip'
    requires = (Mingle, )
    _cons_stamp_fields = itemgetter(
        'id', 'clock', 'hostname', 'pid', 'topic', 'action', 'cver',
    )
    compatible_transports = set(['amqp', 'redis'])

    def __init__(self, c, without_gossip=False, interval=5.0, **kwargs):
        self.enabled = not without_gossip and self.compatible_transport(c.app)
        self.app = c.app
        c.gossip = self
        self.Receiver = c.app.events.Receiver
        self.hostname = c.hostname
        self.full_hostname = '.'.join([self.hostname, str(c.pid)])
        self.on = Bunch(
            node_join=set(),
            node_leave=set(),
            node_lost=set(),
        )

        self.timer = c.timer
        if self.enabled:
            self.state = c.app.events.State(
                on_node_join=self.on_node_join,
                on_node_leave=self.on_node_leave,
                max_tasks_in_memory=1,
            )
            if c.hub:
                c._mutex = DummyLock()
            self.update_state = self.state.event
        self.interval = interval
        self._tref = None
        self.consensus_requests = defaultdict(list)
        self.consensus_replies = {}
        self.event_handlers = {
            'worker.elect': self.on_elect,
            'worker.elect.ack': self.on_elect_ack,
        }
        self.clock = c.app.clock

        self.election_handlers = {
            'task': self.call_task
        }

    def compatible_transport(self, app):
        with app.connection() as conn:
            return conn.transport.driver_type in self.compatible_transports

    def election(self, id, topic, action=None):
        self.consensus_replies[id] = []
        self.dispatcher.send(
            'worker-elect',
            id=id, topic=topic, action=action, cver=1,
        )

    def call_task(self, task):
        try:
            signature(task, app=self.app).apply_async()
        except Exception as exc:
            error('Could not call task: %r', exc, exc_info=1)

    def on_elect(self, event):
        try:
            (id_, clock, hostname, pid,
             topic, action, _) = self._cons_stamp_fields(event)
        except KeyError as exc:
            return error('election request missing field %s', exc, exc_info=1)
        heappush(
            self.consensus_requests[id_],
            (clock, '%s.%s' % (hostname, pid), topic, action),
        )
        self.dispatcher.send('worker-elect-ack', id=id_)

    def start(self, c):
        super(Gossip, self).start(c)
        self.dispatcher = c.event_dispatcher

    def on_elect_ack(self, event):
        id = event['id']
        try:
            replies = self.consensus_replies[id]
        except KeyError:
            return  # not for us
        alive_workers = self.state.alive_workers()
        replies.append(event['hostname'])

        if len(replies) >= len(alive_workers):
            _, leader, topic, action = self.clock.sort_heap(
                self.consensus_requests[id],
            )
            if leader == self.full_hostname:
                info('I won the election %r', id)
                try:
                    handler = self.election_handlers[topic]
                except KeyError:
                    error('Unknown election topic %r', topic, exc_info=1)
                else:
                    handler(action)
            else:
                info('node %s elected for %r', leader, id)
            self.consensus_requests.pop(id, None)
            self.consensus_replies.pop(id, None)

    def on_node_join(self, worker):
        debug('%s joined the party', worker.hostname)
        self._call_handlers(self.on.node_join, worker)

    def on_node_leave(self, worker):
        debug('%s left', worker.hostname)
        self._call_handlers(self.on.node_leave, worker)

    def on_node_lost(self, worker):
        info('missed heartbeat from %s', worker.hostname)
        self._call_handlers(self.on.node_lost, worker)

    def _call_handlers(self, handlers, *args, **kwargs):
        for handler in handlers:
            try:
                handler(*args, **kwargs)
            except Exception as exc:
                error('Ignored error from handler %r: %r',
                      handler, exc, exc_info=1)

    def register_timer(self):
        if self._tref is not None:
            self._tref.cancel()
        self._tref = self.timer.call_repeatedly(self.interval, self.periodic)

    def periodic(self):
        workers = self.state.workers
        dirty = set()
        for worker in values(workers):
            if not worker.alive:
                dirty.add(worker)
                self.on_node_lost(worker)
        for worker in dirty:
            workers.pop(worker.hostname, None)

    def get_consumers(self, channel):
        self.register_timer()
        ev = self.Receiver(channel, routing_key='worker.#')
        return [kombu.Consumer(
            channel,
            queues=[ev.queue],
            on_message=partial(self.on_message, ev.event_from_message),
            no_ack=True
        )]

    def on_message(self, prepare, message):
        _type = message.delivery_info['routing_key']

        # For redis when `fanout_patterns=False` (See Issue #1882)
        if _type.split('.', 1)[0] == 'task':
            return
        try:
            handler = self.event_handlers[_type]
        except KeyError:
            pass
        else:
            return handler(message.payload)

        hostname = (message.headers.get('hostname') or
                    message.payload['hostname'])
        if hostname != self.hostname:
            type, event = prepare(message.payload)
            self.update_state(event)
        else:
            self.clock.forward()


class Evloop(bootsteps.StartStopStep):
    label = 'event loop'
    last = True

    def start(self, c):
        self.patch_all(c)
        c.loop(*c.loop_args())

    def patch_all(self, c):
        c.qos._mutex = DummyLock()
