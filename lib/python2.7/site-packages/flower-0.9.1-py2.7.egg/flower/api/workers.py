from __future__ import absolute_import

import logging

from tornado import web
from tornado import gen

from .control import ControlHandler


logger = logging.getLogger(__name__)


class ListWorkers(ControlHandler):
    @web.authenticated
    @gen.coroutine
    def get(self):
        """
List workers

**Example request**:

.. sourcecode:: http

  GET /api/workers HTTP/1.1
  Host: localhost:5555

**Example response**:

.. sourcecode:: http

  HTTP/1.1 200 OK
  Content-Length: 1526
  Content-Type: application/json; charset=UTF-8
  Date: Tue, 28 Jul 2015 01:32:38 GMT
  Etag: "fcdd75d85a82b4052275e28871d199aac1ece21c"
  Server: TornadoServer/4.0.2

  {
      "celery@worker1": {
          "active_queues": [
              {
                  "alias": null,
                  "auto_delete": false,
                  "binding_arguments": null,
                  "bindings": [],
                  "durable": true,
                  "exchange": {
                      "arguments": null,
                      "auto_delete": false,
                      "delivery_mode": 2,
                      "durable": true,
                      "name": "celery",
                      "passive": false,
                      "type": "direct"
                  },
                  "exclusive": false,
                  "name": "celery",
                  "no_ack": false,
                  "queue_arguments": null,
                  "routing_key": "celery"
              }
          ],
          "conf": {
              "CELERYBEAT_SCHEDULE": {},
              "CELERY_INCLUDE": [
                  "celery.app.builtins",
                  "__main__"
              ],
              "CELERY_SEND_TASK_SENT_EVENT": true,
              "CELERY_TIMEZONE": "UTC"
          },
          "registered": [
              "tasks.add",
              "tasks.echo",
              "tasks.error",
              "tasks.retry",
              "tasks.sleep"
          ],
          "stats": {
              "broker": {
                  "alternates": [],
                  "connect_timeout": 4,
                  "heartbeat": null,
                  "hostname": "127.0.0.1",
                  "insist": false,
                  "login_method": "AMQPLAIN",
                  "port": 5672,
                  "ssl": false,
                  "transport": "amqp",
                  "transport_options": {},
                  "uri_prefix": null,
                  "userid": "guest",
                  "virtual_host": "/"
              },
              "clock": "918",
              "pid": 90494,
              "pool": {
                  "max-concurrency": 4,
                  "max-tasks-per-child": "N/A",
                  "processes": [
                      90499,
                      90500,
                      90501,
                      90502
                  ],
                  "put-guarded-by-semaphore": false,
                  "timeouts": [
                      0,
                      0
                  ],
                  "writes": {
                      "all": "100.00%",
                      "avg": "100.00%",
                      "inqueues": {
                          "active": 0,
                          "total": 4
                      },
                      "raw": "1",
                      "total": 1
                  }
              },
              "prefetch_count": 16,
              "rusage": {
                  "idrss": 0,
                  "inblock": 211,
                  "isrss": 0,
                  "ixrss": 0,
                  "majflt": 6,
                  "maxrss": 26996736,
                  "minflt": 11450,
                  "msgrcv": 4968,
                  "msgsnd": 1227,
                  "nivcsw": 1367,
                  "nsignals": 0,
                  "nswap": 0,
                  "nvcsw": 1855,
                  "oublock": 93,
                  "stime": 0.414564,
                  "utime": 0.975726
              },
              "total": {
                  "tasks.add": 1
              }
          },
          "timestamp": 1438049312.073402
      }
  }

:query refresh: run inspect to get updated list of workers
:query workername: get info for workername
:query status: only get worker status info
:reqheader Authorization: optional OAuth token to authenticate
:statuscode 200: no error
:statuscode 401: unauthorized request
        """
        refresh = self.get_argument('refresh', default=False, type=bool)
        status = self.get_argument('status', default=False, type=bool)
        workername = self.get_argument('workername', default=None)

        if status:
            info = {}
            for name, worker in self.application.events.state.workers.items():
                info[name] = worker.alive
            self.write(info)
            return

        if self.worker_cache and not refresh and\
                workername in self.worker_cache:
            self.write({workername: self.worker_cache[workername]})
            return

        if refresh:
            try:
                yield self.update_cache(workername=workername)
            except Exception as e:
                msg = "Failed to update workers: %s" % e
                logger.error(msg)
                raise web.HTTPError(503, msg)

        if workername and not self.is_worker(workername):
            raise web.HTTPError(404, "Unknown worker '%s'" % workername)

        if workername:
            self.write({workername: self.worker_cache[workername]})
        else:
            self.write(self.worker_cache)
