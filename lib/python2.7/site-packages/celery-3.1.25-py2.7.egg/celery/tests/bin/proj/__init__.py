from __future__ import absolute_import

from celery import Celery

hello = Celery(set_as_current=False)
