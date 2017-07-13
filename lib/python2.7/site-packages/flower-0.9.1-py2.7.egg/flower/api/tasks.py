from __future__ import absolute_import

import json
import logging

from datetime import datetime
from threading import Thread

from tornado import web
from tornado import gen
from tornado.escape import json_decode
from tornado.web import HTTPError

from celery import states
from celery.result import AsyncResult
from celery.contrib.abortable import AbortableAsyncResult
from celery.backends.base import DisabledBackend

from ..utils import tasks
from ..views import BaseHandler
from ..utils.broker import Broker
from ..api.control import ControlHandler


logger = logging.getLogger(__name__)


class BaseTaskHandler(BaseHandler):
    def get_task_args(self):
        try:
            body = self.request.body
            options = json_decode(body) if body else {}
        except ValueError as e:
            raise HTTPError(400, str(e))
        args = options.pop('args', [])
        kwargs = options.pop('kwargs', {})

        if not isinstance(args, (list, tuple)):
            raise HTTPError(400, 'args must be an array')

        return args, kwargs, options

    @staticmethod
    def backend_configured(result):
        return not isinstance(result.backend, DisabledBackend)

    def write_error(self, status_code, **kwargs):
        self.set_status(status_code)

    def update_response_result(self, response, result):
        if result.state == states.FAILURE:
            response.update({'result': self.safe_result(result.result),
                             'traceback': result.traceback})
        else:
            response.update({'result': self.safe_result(result.result)})

    def normalize_options(self, options):
        if 'eta' in options:
            options['eta'] = datetime.strptime(options['eta'],
                                               self.DATE_FORMAT)
        if 'countdown' in options:
            options['countdown'] = float(options['countdown'])
        if 'expires' in options:
            expires = options['expires']
            try:
                expires = float(expires)
            except ValueError:
                expires = datetime.strptime(expires, self.DATE_FORMAT)
            options['expires'] = expires

    def safe_result(self, result):
        "returns json encodable result"
        try:
            json.dumps(result)
        except TypeError:
            return repr(result)
        else:
            return result


class TaskApply(BaseTaskHandler):
    @web.authenticated
    @web.asynchronous
    def post(self, taskname):
        """
Execute a task by name and wait results

**Example request**:

.. sourcecode:: http

  POST /api/task/apply/tasks.add HTTP/1.1
  Accept: application/json
  Accept-Encoding: gzip, deflate, compress
  Content-Length: 16
  Content-Type: application/json; charset=utf-8
  Host: localhost:5555

  {
      "args": [1, 2]
  }

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 71
  Content-Type: application/json; charset=UTF-8

  {
      "state": "SUCCESS",
      "task-id": "c60be250-fe52-48df-befb-ac66174076e6",
      "result": 3
  }

:query args: a list of arguments
:query kwargs: a dictionary of arguments
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task
        """
        args, kwargs, options = self.get_task_args()
        logger.debug("Invoking a task '%s' with '%s' and '%s'",
                     taskname, args, kwargs)

        try:
            task = self.capp.tasks[taskname]
        except KeyError:
            raise HTTPError(404, "Unknown task '%s'" % taskname)

        try:
            self.normalize_options(options)
        except ValueError:
            raise HTTPError(400, 'Invalid option')

        result = task.apply_async(args=args, kwargs=kwargs, **options)
        response = {'task-id': result.task_id}

        # In tornado for not blocking event loop we must return results
        # from other thread by self.finish()
        th = Thread(target=self.wait_results, args=(result, response, ))
        th.start()
        # So just exit

    def wait_results(self, result, response):
        # Wait until task finished and do not raise anything
        result.get(propagate=False)
        # Write results and finish async function
        self.update_response_result(response, result)
        if self.backend_configured(result):
            response.update(state=result.state)
        self.finish(response)


class TaskAsyncApply(BaseTaskHandler):
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S.%f'

    @web.authenticated
    def post(self, taskname):
        """
Execute a task

**Example request**:

.. sourcecode:: http

  POST /api/task/async-apply/tasks.add HTTP/1.1
  Accept: application/json
  Accept-Encoding: gzip, deflate, compress
  Content-Length: 16
  Content-Type: application/json; charset=utf-8
  Host: localhost:5555

  {
      "args": [1, 2]
  }

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 71
  Content-Type: application/json; charset=UTF-8
  Date: Sun, 13 Apr 2014 15:55:00 GMT

  {
      "state": "PENDING",
      "task-id": "abc300c7-2922-4069-97b6-a635cc2ac47c"
  }

:query args: a list of arguments
:query kwargs: a dictionary of arguments
:query options: a dictionary of `apply_async` keyword arguments
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task
        """
        args, kwargs, options = self.get_task_args()
        logger.debug("Invoking a task '%s' with '%s' and '%s'",
                     taskname, args, kwargs)

        try:
            task = self.capp.tasks[taskname]
        except KeyError:
            raise HTTPError(404, "Unknown task '%s'" % taskname)

        try:
            self.normalize_options(options)
        except ValueError:
            raise HTTPError(400, 'Invalid option')

        result = task.apply_async(args=args, kwargs=kwargs, **options)
        response = {'task-id': result.task_id}
        if self.backend_configured(result):
            response.update(state=result.state)
        self.write(response)


class TaskSend(BaseTaskHandler):
    @web.authenticated
    def post(self, taskname):
        """
Execute a task by name (doesn't require task sources)

**Example request**:

.. sourcecode:: http

  POST /api/task/send-task/tasks.add HTTP/1.1
  Accept: application/json
  Accept-Encoding: gzip, deflate, compress
  Content-Length: 16
  Content-Type: application/json; charset=utf-8
  Host: localhost:5555

  {
      "args": [1, 2]
  }

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 71
  Content-Type: application/json; charset=UTF-8

  {
      "state": "SUCCESS",
      "task-id": "c60be250-fe52-48df-befb-ac66174076e6"
  }

:query args: a list of arguments
:query kwargs: a dictionary of arguments
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task
        """
        args, kwargs, options = self.get_task_args()
        logger.debug("Invoking task '%s' with '%s' and '%s'",
                     taskname, args, kwargs)
        result = self.capp.send_task(
            taskname, args=args, kwargs=kwargs, **options)
        response = {'task-id': result.task_id}
        if self.backend_configured(result):
            response.update(state=result.state)
        self.write(response)


class TaskResult(BaseTaskHandler):
    @web.authenticated
    def get(self, taskid):
        """
Get a task result

**Example request**:

.. sourcecode:: http

  GET /api/task/result/c60be250-fe52-48df-befb-ac66174076e6 HTTP/1.1
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 84
  Content-Type: application/json; charset=UTF-8

  {
      "result": 3,
      "state": "SUCCESS",
      "task-id": "c60be250-fe52-48df-befb-ac66174076e6"
  }

:query timeout: how long to wait, in seconds, before the operation times out
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 503: result backend is not configured
        """
        timeout = self.get_argument('timeout', None)
        timeout = float(timeout) if timeout is not None else None

        result = AsyncResult(taskid)
        if not self.backend_configured(result):
            raise HTTPError(503)
        response = {'task-id': taskid, 'state': result.state}

        if timeout:
            result.get(timeout=timeout, propagate=False)
            self.update_response_result(response, result)
        elif result.ready():
            self.update_response_result(response, result)
        self.write(response)


class TaskAbort(BaseTaskHandler):
    @web.authenticated
    def post(self, taskid):
        """
Abort a running task

**Example request**:

.. sourcecode:: http

  POST /api/task/abort/c60be250-fe52-48df-befb-ac66174076e6 HTTP/1.1
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 61
  Content-Type: application/json; charset=UTF-8

  {
      "message": "Aborted '1480b55c-b8b2-462c-985e-24af3e9158f9'"
  }

:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 503: result backend is not configured
        """
        logger.info("Aborting task '%s'", taskid)

        result = AbortableAsyncResult(taskid)
        if not self.backend_configured(result):
            raise HTTPError(503)

        result.abort()

        self.write(dict(message="Aborted '%s'" % taskid))


class GetQueueLengths(BaseTaskHandler):
    @web.authenticated
    @gen.coroutine
    def get(self):
        app = self.application
        broker_options = self.capp.conf.BROKER_TRANSPORT_OPTIONS

        http_api = None
        if app.transport == 'amqp' and app.options.broker_api:
            http_api = app.options.broker_api

        broker = Broker(app.capp.connection().as_uri(include_password=True),
                        http_api=http_api, broker_options=broker_options)

        queue_names = ControlHandler.get_active_queue_names()

        if not queue_names:
            queue_names = set([self.capp.conf.CELERY_DEFAULT_QUEUE])

        queues = yield broker.queues(sorted(queue_names))
        self.write({'active_queues': queues})


class ListTasks(BaseTaskHandler):
    @web.authenticated
    def get(self):
        """
List tasks

**Example request**:

.. sourcecode:: http

  GET /api/tasks HTTP/1.1
  Host: localhost:5555
  User-Agent: HTTPie/0.8.0

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 1109
  Content-Type: application/json; charset=UTF-8
  Etag: "b2478118015c8b825f7b88ce6b660e5449746c37"
  Server: TornadoServer/3.1.1

  {
      "e42ceb2d-8730-47b5-8b4d-8e0d2a1ef7c9": {
          "args": "[3, 4]",
          "client": null,
          "clock": 1079,
          "eta": null,
          "exception": null,
          "exchange": null,
          "expires": null,
          "failed": null,
          "kwargs": "{}",
          "name": "tasks.add",
          "received": 1398505411.107885,
          "result": "'7'",
          "retried": null,
          "retries": 0,
          "revoked": null,
          "routing_key": null,
          "runtime": 0.01610181899741292,
          "sent": null,
          "started": 1398505411.108985,
          "state": "SUCCESS",
          "succeeded": 1398505411.124802,
          "timestamp": 1398505411.124802,
          "traceback": null,
          "uuid": "e42ceb2d-8730-47b5-8b4d-8e0d2a1ef7c9"
      },
      "f67ea225-ae9e-42a8-90b0-5de0b24507e0": {
          "args": "[1, 2]",
          "client": null,
          "clock": 1042,
          "eta": null,
          "exception": null,
          "exchange": null,
          "expires": null,
          "failed": null,
          "kwargs": "{}",
          "name": "tasks.add",
          "received": 1398505395.327208,
          "result": "'3'",
          "retried": null,
          "retries": 0,
          "revoked": null,
          "routing_key": null,
          "runtime": 0.012884548006695695,
          "sent": null,
          "started": 1398505395.3289,
          "state": "SUCCESS",
          "succeeded": 1398505395.341089,
          "timestamp": 1398505395.341089,
          "traceback": null,
          "uuid": "f67ea225-ae9e-42a8-90b0-5de0b24507e0"
      }
  }

:query limit: maximum number of tasks
:query workername: filter task by workername
:query taskname: filter tasks by taskname
:query state: filter tasks by state
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
        """
        app = self.application
        limit = self.get_argument('limit', None)
        worker = self.get_argument('workername', None)
        type = self.get_argument('taskname', None)
        state = self.get_argument('state', None)

        limit = limit and int(limit)
        worker = worker if worker != 'All' else None
        type = type if type != 'All' else None
        state = state if state != 'All' else None

        result = []
        for task_id, task in tasks.iter_tasks(
                app.events, limit=limit, type=type,
                worker=worker, state=state):
            task = tasks.as_dict(task)
            task.pop('worker', None)
            result.append((task_id, task))
        self.write(dict(result))


class ListTaskTypes(BaseTaskHandler):
    @web.authenticated
    def get(self):
        """
List (seen) task types

**Example request**:

.. sourcecode:: http

  GET /api/task/types HTTP/1.1
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 44
  Content-Type: application/json; charset=UTF-8

  {
      "task-types": [
          "tasks.add",
          "tasks.sleep"
      ]
  }

:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
        """
        seen_task_types = self.application.events.state.task_types()

        response = {}
        response['task-types'] = seen_task_types
        self.write(response)


class TaskInfo(BaseTaskHandler):
    @web.authenticated
    def get(self, taskid):
        """
Get a task info

**Example request**:

.. sourcecode:: http

  GET /api/task/info/91396550-c228-4111-9da4-9d88cfd5ddc6 HTTP/1.1
  Accept: */*
  Accept-Encoding: gzip, deflate, compress
  Host: localhost:5555


**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 575
  Content-Type: application/json; charset=UTF-8

  {
      "args": "[2, 2]",
      "client": null,
      "clock": 25,
      "eta": null,
      "exception": null,
      "exchange": null,
      "expires": null,
      "failed": null,
      "kwargs": "{}",
      "name": "tasks.add",
      "received": 1400806241.970742,
      "result": "'4'",
      "retried": null,
      "retries": null,
      "revoked": null,
      "routing_key": null,
      "runtime": 2.0037889280356467,
      "sent": null,
      "started": 1400806241.972624,
      "state": "SUCCESS",
      "succeeded": 1400806243.975336,
      "task-id": "91396550-c228-4111-9da4-9d88cfd5ddc6",
      "timestamp": 1400806243.975336,
      "traceback": null,
      "worker": "celery@worker1"
  }

:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
:statuscode 404: unknown task
        """

        task = tasks.get_task_by_id(self.application.events, taskid)
        if not task:
            raise HTTPError(404, "Unknown task '%s'" % taskid)
        response = {}
        for name in task._fields:
            if name not in ['uuid', 'worker']:
                response[name] = getattr(task, name, None)
        response['task-id'] = task.uuid
        response['worker'] = task.worker.hostname
        self.write(response)
