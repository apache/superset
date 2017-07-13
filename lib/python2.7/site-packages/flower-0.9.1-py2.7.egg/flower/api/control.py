from __future__ import absolute_import

import time
import logging
import collections

from tornado import web
from tornado import gen

from ..views import BaseHandler


logger = logging.getLogger(__name__)


class ControlHandler(BaseHandler):
    INSPECT_METHODS = ('stats', 'active_queues', 'registered', 'scheduled',
                       'active', 'reserved', 'revoked', 'conf')
    worker_cache = collections.defaultdict(dict)

    @gen.coroutine
    def update_cache(self, workername=None):
        yield self.update_workers(workername=workername,
                                  app=self.application)

    @classmethod
    @gen.coroutine
    def update_workers(cls, app, workername=None):
        logger.debug("Updating %s worker's cache...", workername or 'all')

        futures = []
        destination = [workername] if workername else None
        timeout = app.options.inspect_timeout / 1000.0
        inspect = app.capp.control.inspect(
            timeout=timeout, destination=destination)
        for method in cls.INSPECT_METHODS:
            futures.append(app.delay(getattr(inspect, method)))

        results = yield futures

        for i, result in enumerate(results):
            if result is None:
                logger.warning("'%s' inspect method failed",
                               cls.INSPECT_METHODS[i])
                continue
            for worker, response in result.items():
                if response is not None:
                    info = cls.worker_cache[worker]
                    info[cls.INSPECT_METHODS[i]] = response
                    info['timestamp'] = time.time()

    def is_worker(self, workername):
        return workername and workername in self.worker_cache

    def error_reason(self, workername, response):
        "extracts error message from response"
        for r in response:
            try:
                return r[workername].get('error', 'Unknown reason')
            except KeyError:
                pass
        logger.error("Failed to extract error reason from '%s'", response)
        return 'Unknown reason'

    @classmethod
    def get_active_queue_names(cls):
        queues = set([])
        for worker, info in cls.worker_cache.items():
            for q in info.get('active_queues', []):
                queues.add(q['name'])
        return queues


class WorkerShutDown(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Shut down a worker

**Example request**:

.. sourcecode:: http

  POST /api/worker/shutdown/celery@worker2 HTTP/1.1
  Content-Length: 0
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 29
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Shutting down!"
  }

:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown worker
        """
        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        logger.info("Shutting down '%s' worker", workername)
        self.capp.control.broadcast('shutdown', destination=[workername])
        self.write(dict(message="Shutting down!"))


class WorkerPoolRestart(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Restart worker's pool

**Example request**:

.. sourcecode:: http

  POST /api/worker/pool/restart/celery@worker2 HTTP/1.1
  Content-Length: 0
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 56
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Restarting 'celery@worker2' worker's pool"
  }

:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: pool restart is not enabled (see CELERYD_POOL_RESTARTS)
:statuscode 404: unknown worker
        """
        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        logger.info("Restarting '%s' worker's pool", workername)
        response = self.capp.control.broadcast(
            'pool_restart', arguments={'reload': False},
            destination=[workername], reply=True)
        if response and 'ok' in response[0][workername]:
            self.write(dict(
                message="Restarting '%s' worker's pool" % workername))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to restart the '%s' pool: %s" % (
                workername, self.error_reason(workername, response)
            ))


class WorkerPoolGrow(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Grow worker's pool

**Example request**:

.. sourcecode:: http

  POST /api/worker/pool/grow/celery@worker2?n=3 HTTP/1.1
  Content-Length: 0
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 58
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Growing 'celery@worker2' worker's pool by 3"
  }

:query n: number of pool processes to grow, default is 1
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: failed to grow
:statuscode 404: unknown worker
        """

        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        n = self.get_argument('n', default=1, type=int)

        logger.info("Growing '%s' worker's pool by '%s'", workername, n)
        response = self.capp.control.pool_grow(
            n=n, reply=True, destination=[workername])
        if response and 'ok' in response[0][workername]:
            self.write(dict(
                message="Growing '%s' worker's pool by %s" % (workername, n)))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to grow '%s' worker's pool: %s" % (
                workername, self.error_reason(workername, response)))


class WorkerPoolShrink(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Shrink worker's pool

**Example request**:

.. sourcecode:: http

  POST /api/worker/pool/shrink/celery@worker2 HTTP/1.1
  Content-Length: 0
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 60
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Shrinking 'celery@worker2' worker's pool by 1"
  }

:query n: number of pool processes to shrink, default is 1
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: failed to shrink
:statuscode 404: unknown worker
        """

        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        n = self.get_argument('n', default=1, type=int)

        logger.info("Shrinking '%s' worker's pool by '%s'", workername, n)
        response = self.capp.control.pool_shrink(
            n=n, reply=True, destination=[workername])
        if response and 'ok' in response[0][workername]:
            self.write(dict(message="Shrinking '%s' worker's pool by %s" % (
                            workername, n)))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to shrink '%s' worker's pool: %s" % (
                workername, self.error_reason(workername, response)
            ))


class WorkerPoolAutoscale(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Autoscale worker pool

**Example request**:

.. sourcecode:: http

  POST /api/worker/pool/autoscale/celery@worker2?min=3&max=10 HTTP/1.1
  Content-Length: 0
  Content-Type: application/x-www-form-urlencoded; charset=utf-8
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 66
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Autoscaling 'celery@worker2' worker (min=3, max=10)"
  }

:query min: minimum number of pool processes
:query max: maximum number of pool processes
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: autoscaling is not enabled (see CELERYD_AUTOSCALER)
:statuscode 404: unknown worker
        """

        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        min = self.get_argument('min', type=int)
        max = self.get_argument('max', type=int)

        logger.info("Autoscaling '%s' worker by '%s'",
                    workername, (min, max))
        response = self.capp.control.broadcast(
            'autoscale', arguments={'min': min, 'max': max},
            destination=[workername], reply=True)
        if response and 'ok' in response[0][workername]:
            self.write(dict(message="Autoscaling '%s' worker "
                                    "(min=%s, max=%s)" % (
                                        workername, min, max)))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to autoscale '%s' worker: %s" % (
                workername, self.error_reason(workername, response)
            ))


class WorkerQueueAddConsumer(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Start consuming from a queue

**Example request**:

.. sourcecode:: http

  POST /api/worker/queue/add-consumer/celery@worker2?queue=sample-queue
  Content-Length: 0
  Content-Type: application/x-www-form-urlencoded; charset=utf-8
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 40
  Content-Type: application/json; charset=UTF-8

  {
      "message": "add consumer sample-queue"
  }

:query queue: the name of a new queue
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: failed to add consumer
:statuscode 404: unknown worker
        """
        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        queue = self.get_argument('queue')

        logger.info("Adding consumer '%s' to worker '%s'",
                    queue, workername)
        response = self.capp.control.broadcast(
            'add_consumer', arguments={'queue': queue},
            destination=[workername], reply=True)
        if response and 'ok' in response[0][workername]:
            self.write(dict(message=response[0][workername]['ok']))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to add '%s' consumer to '%s' worker: %s" % (
                queue, workername, self.error_reason(workername, response)
            ))


class WorkerQueueCancelConsumer(ControlHandler):
    @web.authenticated
    def post(self, workername):
        """
Stop consuming from a queue

**Example request**:

.. sourcecode:: http

  POST /api/worker/queue/cancel-consumer/celery@worker2?queue=sample-queue
  Content-Length: 0
  Content-Type: application/x-www-form-urlencoded; charset=utf-8
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 52
  Content-Type: application/json; charset=UTF-8

  {
      "message": "no longer consuming from sample-queue"
  }

:query queue: the name of queue
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 403: failed to cancel consumer
:statuscode 404: unknown worker
        """
        if not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        queue = self.get_argument('queue')

        logger.info("Canceling consumer '%s' from worker '%s'",
                    queue, workername)
        response = self.capp.control.broadcast(
            'cancel_consumer', arguments={'queue': queue},
            destination=[workername], reply=True)
        if response and 'ok' in response[0][workername]:
            self.write(dict(message=response[0][workername]['ok']))
        else:
            logger.error(response)
            self.set_status(403)
            self.write(
                "Failed to cancel '%s' consumer from '%s' worker: %s" % (
                    queue, workername, self.error_reason(workername, response)
                ))


class TaskRevoke(ControlHandler):
    @web.authenticated
    def post(self, taskid):
        """
Revoke a task

**Example request**:

.. sourcecode:: http

  POST /api/task/revoke/1480b55c-b8b2-462c-985e-24af3e9158f9?terminate=true
  Content-Length: 0
  Content-Type: application/x-www-form-urlencoded; charset=utf-8
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 61
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Revoked '1480b55c-b8b2-462c-985e-24af3e9158f9'"
  }

:query terminate: terminate the task if it is running
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
        """
        logger.info("Revoking task '%s'", taskid)
        terminate = self.get_argument('terminate', default=False, type=bool)
        self.capp.control.revoke(taskid, terminate=terminate)
        self.write(dict(message="Revoked '%s'" % taskid))


class TaskTimout(ControlHandler):
    @web.authenticated
    def post(self, taskname):
        """
Change soft and hard time limits for a task

**Example request**:

.. sourcecode:: http

    POST /api/task/timeout/tasks.sleep HTTP/1.1
    Content-Length: 44
    Content-Type: application/x-www-form-urlencoded; charset=utf-8
    Host: localhost:5555

    soft=30&hard=100&workername=celery%40worker1

**Example response**:

.. sourcecode:: http

    HTTP/1.1 200 OK
    Content-Length: 46
    Content-Type: application/json; charset=UTF-8

    {
        "message": "new rate limit set successfully"
    }

:query workername: worker name
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task/worker
        """
        workername = self.get_argument('workername')
        hard = self.get_argument('hard', default=None, type=float)
        soft = self.get_argument('soft', default=None, type=float)

        if taskname not in self.capp.tasks:
            raise web.HTTPError(404, "Unknown task '%s'" % taskname)
        if workername is not None and not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        logger.info("Setting timeouts for '%s' task (%s, %s)",
                    taskname, soft, hard)
        destination = [workername] if workername is not None else None
        response = self.capp.control.time_limit(
            taskname, reply=True, hard=hard, soft=soft,
            destination=destination)

        if response and 'ok' in response[0][workername]:
            self.write(dict(message=response[0][workername]['ok']))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to set timeouts: '%s'" %
                       self.error_reason(taskname, response))


class TaskRateLimit(ControlHandler):
    @web.authenticated
    def post(self, taskname):
        """
Change rate limit for a task

**Example request**:

.. sourcecode:: http

    POST /api/task/rate-limit/tasks.sleep HTTP/1.1
    Content-Length: 41
    Content-Type: application/x-www-form-urlencoded; charset=utf-8
    Host: localhost:5555

    ratelimit=200&workername=celery%40worker1

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 61
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Revoked '1480b55c-b8b2-462c-985e-24af3e9158f9'"
  }

:query workername: worker name
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task/worker
        """
        workername = self.get_argument('workername')
        ratelimit = self.get_argument('ratelimit')

        if taskname not in self.capp.tasks:
            raise web.HTTPError(404, "Unknown task '%s'" % taskname)
        if workername is not None and not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        logger.info("Setting '%s' rate limit for '%s' task",
                    ratelimit, taskname)
        destination = [workername] if workername is not None else None
        response = self.capp.control.rate_limit(
            taskname, ratelimit, reply=True, destination=destination)
        if response and 'ok' in response[0][workername]:
            self.write(dict(message=response[0][workername]['ok']))
        else:
            logger.error(response)
            self.set_status(403)
            self.write("Failed to set rate limit: '%s'" %
                       self.error_reason(taskname, response))
