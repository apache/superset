# -*- coding: utf-8 -*-
"""
    celery.app.builtins
    ~~~~~~~~~~~~~~~~~~~

    Built-in tasks that are always available in all
    app instances. E.g. chord, group and xmap.

"""
from __future__ import absolute_import

from collections import deque

from celery._state import get_current_worker_task, connect_on_app_finalize
from celery.utils import uuid
from celery.utils.log import get_logger

__all__ = []

logger = get_logger(__name__)


@connect_on_app_finalize
def add_backend_cleanup_task(app):
    """The backend cleanup task can be used to clean up the default result
    backend.

    If the configured backend requires periodic cleanup this task is also
    automatically configured to run every day at 4am (requires
    :program:`celery beat` to be running).

    """
    @app.task(name='celery.backend_cleanup',
              shared=False, _force_evaluate=True)
    def backend_cleanup():
        app.backend.cleanup()
    return backend_cleanup


@connect_on_app_finalize
def add_unlock_chord_task(app):
    """This task is used by result backends without native chord support.

    It joins chords by creating a task chain polling the header for completion.

    """
    from celery.canvas import signature
    from celery.exceptions import ChordError
    from celery.result import allow_join_result, result_from_tuple

    default_propagate = app.conf.CELERY_CHORD_PROPAGATES

    @app.task(name='celery.chord_unlock', max_retries=None, shared=False,
              default_retry_delay=1, ignore_result=True, _force_evaluate=True,
              bind=True)
    def unlock_chord(self, group_id, callback, interval=None, propagate=None,
                     max_retries=None, result=None,
                     Result=app.AsyncResult, GroupResult=app.GroupResult,
                     result_from_tuple=result_from_tuple):
        # if propagate is disabled exceptions raised by chord tasks
        # will be sent as part of the result list to the chord callback.
        # Since 3.1 propagate will be enabled by default, and instead
        # the chord callback changes state to FAILURE with the
        # exception set to ChordError.
        propagate = default_propagate if propagate is None else propagate
        if interval is None:
            interval = self.default_retry_delay

        # check if the task group is ready, and if so apply the callback.
        deps = GroupResult(
            group_id,
            [result_from_tuple(r, app=app) for r in result],
            app=app,
        )
        j = deps.join_native if deps.supports_native_join else deps.join

        try:
            ready = deps.ready()
        except Exception as exc:
            raise self.retry(
                exc=exc, countdown=interval, max_retries=max_retries,
            )
        else:
            if not ready:
                raise self.retry(countdown=interval, max_retries=max_retries)

        callback = signature(callback, app=app)
        try:
            with allow_join_result():
                ret = j(timeout=3.0, propagate=propagate)
        except Exception as exc:
            try:
                culprit = next(deps._failed_join_report())
                reason = 'Dependency {0.id} raised {1!r}'.format(
                    culprit, exc,
                )
            except StopIteration:
                reason = repr(exc)
            logger.error('Chord %r raised: %r', group_id, exc, exc_info=1)
            app.backend.chord_error_from_stack(callback,
                                               ChordError(reason))
        else:
            try:
                callback.delay(ret)
            except Exception as exc:
                logger.error('Chord %r raised: %r', group_id, exc, exc_info=1)
                app.backend.chord_error_from_stack(
                    callback,
                    exc=ChordError('Callback error: {0!r}'.format(exc)),
                )
    return unlock_chord


@connect_on_app_finalize
def add_map_task(app):
    from celery.canvas import signature

    @app.task(name='celery.map', shared=False, _force_evaluate=True)
    def xmap(task, it):
        task = signature(task, app=app).type
        return [task(item) for item in it]
    return xmap


@connect_on_app_finalize
def add_starmap_task(app):
    from celery.canvas import signature

    @app.task(name='celery.starmap', shared=False, _force_evaluate=True)
    def xstarmap(task, it):
        task = signature(task, app=app).type
        return [task(*item) for item in it]
    return xstarmap


@connect_on_app_finalize
def add_chunk_task(app):
    from celery.canvas import chunks as _chunks

    @app.task(name='celery.chunks', shared=False, _force_evaluate=True)
    def chunks(task, it, n):
        return _chunks.apply_chunks(task, it, n)
    return chunks


@connect_on_app_finalize
def add_group_task(app):
    _app = app
    from celery.canvas import maybe_signature, signature
    from celery.result import result_from_tuple

    class Group(app.Task):
        app = _app
        name = 'celery.group'
        accept_magic_kwargs = False
        _decorated = True

        def run(self, tasks, result, group_id, partial_args,
                add_to_parent=True):
            app = self.app
            result = result_from_tuple(result, app)
            # any partial args are added to all tasks in the group
            taskit = (signature(task, app=app).clone(partial_args)
                      for i, task in enumerate(tasks))
            if self.request.is_eager or app.conf.CELERY_ALWAYS_EAGER:
                return app.GroupResult(
                    result.id,
                    [stask.apply(group_id=group_id) for stask in taskit],
                )
            with app.producer_or_acquire() as pub:
                [stask.apply_async(group_id=group_id, producer=pub,
                                   add_to_parent=False) for stask in taskit]
            parent = get_current_worker_task()
            if add_to_parent and parent:
                parent.add_trail(result)
            return result

        def prepare(self, options, tasks, args, **kwargs):
            options['group_id'] = group_id = (
                options.setdefault('task_id', uuid()))

            def prepare_member(task):
                task = maybe_signature(task, app=self.app)
                task.options['group_id'] = group_id
                return task, task.freeze()

            try:
                tasks, res = list(zip(
                    *[prepare_member(task) for task in tasks]
                ))
            except ValueError:  # tasks empty
                tasks, res = [], []
            return (tasks, self.app.GroupResult(group_id, res), group_id, args)

        def apply_async(self, partial_args=(), kwargs={}, **options):
            if self.app.conf.CELERY_ALWAYS_EAGER:
                return self.apply(partial_args, kwargs, **options)
            tasks, result, gid, args = self.prepare(
                options, args=partial_args, **kwargs
            )
            super(Group, self).apply_async((
                list(tasks), result.as_tuple(), gid, args), **options
            )
            return result

        def apply(self, args=(), kwargs={}, **options):
            return super(Group, self).apply(
                self.prepare(options, args=args, **kwargs),
                **options).get()
    return Group


@connect_on_app_finalize
def add_chain_task(app):
    from celery.canvas import (
        Signature, chain, chord, group, maybe_signature, maybe_unroll_group,
    )

    _app = app

    class Chain(app.Task):
        app = _app
        name = 'celery.chain'
        accept_magic_kwargs = False
        _decorated = True

        def prepare_steps(self, args, tasks):
            app = self.app
            steps = deque(tasks)
            next_step = prev_task = prev_res = None
            tasks, results = [], []
            i = 0
            while steps:
                # First task get partial args from chain.
                task = maybe_signature(steps.popleft(), app=app)
                task = task.clone() if i else task.clone(args)
                res = task.freeze()
                i += 1

                if isinstance(task, group):
                    task = maybe_unroll_group(task)
                if isinstance(task, chain):
                    # splice the chain
                    steps.extendleft(reversed(task.tasks))
                    continue

                elif isinstance(task, group) and steps and \
                        not isinstance(steps[0], group):
                    # automatically upgrade group(..) | s to chord(group, s)
                    try:
                        next_step = steps.popleft()
                        # for chords we freeze by pretending it's a normal
                        # task instead of a group.
                        res = Signature.freeze(next_step)
                        task = chord(task, body=next_step, task_id=res.task_id)
                    except IndexError:
                        pass  # no callback, so keep as group
                if prev_task:
                    # link previous task to this task.
                    prev_task.link(task)
                    # set the results parent attribute.
                    if not res.parent:
                        res.parent = prev_res

                if not isinstance(prev_task, chord):
                    results.append(res)
                    tasks.append(task)
                prev_task, prev_res = task, res

            return tasks, results

        def apply_async(self, args=(), kwargs={}, group_id=None, chord=None,
                        task_id=None, link=None, link_error=None, **options):
            if self.app.conf.CELERY_ALWAYS_EAGER:
                return self.apply(args, kwargs, **options)
            options.pop('publisher', None)
            tasks, results = self.prepare_steps(args, kwargs['tasks'])
            result = results[-1]
            if group_id:
                tasks[-1].set(group_id=group_id)
            if chord:
                tasks[-1].set(chord=chord)
            if task_id:
                tasks[-1].set(task_id=task_id)
                result = tasks[-1].type.AsyncResult(task_id)
            # make sure we can do a link() and link_error() on a chain object.
            if link:
                tasks[-1].set(link=link)
            # and if any task in the chain fails, call the errbacks
            if link_error:
                for task in tasks:
                    task.set(link_error=link_error)
            tasks[0].apply_async(**options)
            return result

        def apply(self, args=(), kwargs={}, signature=maybe_signature,
                  **options):
            app = self.app
            last, fargs = None, args  # fargs passed to first task only
            for task in kwargs['tasks']:
                res = signature(task, app=app).clone(fargs).apply(
                    last and (last.get(), ),
                )
                res.parent, last, fargs = last, res, None
            return last
    return Chain


@connect_on_app_finalize
def add_chord_task(app):
    """Every chord is executed in a dedicated task, so that the chord
    can be used as a signature, and this generates the task
    responsible for that."""
    from celery import group
    from celery.canvas import maybe_signature
    _app = app
    default_propagate = app.conf.CELERY_CHORD_PROPAGATES

    class Chord(app.Task):
        app = _app
        name = 'celery.chord'
        accept_magic_kwargs = False
        ignore_result = False
        _decorated = True

        def run(self, header, body, partial_args=(), interval=None,
                countdown=1, max_retries=None, propagate=None,
                eager=False, **kwargs):
            app = self.app
            propagate = default_propagate if propagate is None else propagate
            group_id = uuid()

            # - convert back to group if serialized
            tasks = header.tasks if isinstance(header, group) else header
            header = group([
                maybe_signature(s, app=app).clone() for s in tasks
            ], app=self.app)
            # - eager applies the group inline
            if eager:
                return header.apply(args=partial_args, task_id=group_id)

            body['chord_size'] = len(header.tasks)
            results = header.freeze(group_id=group_id, chord=body).results

            return self.backend.apply_chord(
                header, partial_args, group_id,
                body, interval=interval, countdown=countdown,
                max_retries=max_retries, propagate=propagate, result=results,
            )

        def apply_async(self, args=(), kwargs={}, task_id=None,
                        group_id=None, chord=None, **options):
            app = self.app
            if app.conf.CELERY_ALWAYS_EAGER:
                return self.apply(args, kwargs, **options)
            header = kwargs.pop('header')
            body = kwargs.pop('body')
            header, body = (maybe_signature(header, app=app),
                            maybe_signature(body, app=app))
            # forward certain options to body
            if chord is not None:
                body.options['chord'] = chord
            if group_id is not None:
                body.options['group_id'] = group_id
            [body.link(s) for s in options.pop('link', [])]
            [body.link_error(s) for s in options.pop('link_error', [])]
            body_result = body.freeze(task_id)
            parent = super(Chord, self).apply_async((header, body, args),
                                                    kwargs, **options)
            body_result.parent = parent
            return body_result

        def apply(self, args=(), kwargs={}, propagate=True, **options):
            body = kwargs['body']
            res = super(Chord, self).apply(args, dict(kwargs, eager=True),
                                           **options)
            return maybe_signature(body, app=self.app).apply(
                args=(res.get(propagate=propagate).get(), ))
    return Chord
