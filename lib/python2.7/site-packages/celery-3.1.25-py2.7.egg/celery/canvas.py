# -*- coding: utf-8 -*-
"""
    celery.canvas
    ~~~~~~~~~~~~~

    Composing task workflows.

    Documentation for some of these types are in :mod:`celery`.
    You should import these from :mod:`celery` and not this module.


"""
from __future__ import absolute_import

from collections import MutableSequence
from copy import deepcopy
from functools import partial as _partial, reduce
from operator import itemgetter
from itertools import chain as _chain

from kombu.utils import cached_property, fxrange, kwdict, reprcall, uuid

from celery._state import current_app
from celery.utils.functional import (
    maybe_list, is_list, regen,
    chunks as _chunks,
)
from celery.utils.text import truncate

__all__ = ['Signature', 'chain', 'xmap', 'xstarmap', 'chunks',
           'group', 'chord', 'signature', 'maybe_signature']


class _getitem_property(object):
    """Attribute -> dict key descriptor.

    The target object must support ``__getitem__``,
    and optionally ``__setitem__``.

    Example:

        >>> from collections import defaultdict

        >>> class Me(dict):
        ...     deep = defaultdict(dict)
        ...
        ...     foo = _getitem_property('foo')
        ...     deep_thing = _getitem_property('deep.thing')


        >>> me = Me()
        >>> me.foo
        None

        >>> me.foo = 10
        >>> me.foo
        10
        >>> me['foo']
        10

        >>> me.deep_thing = 42
        >>> me.deep_thing
        42
        >>> me.deep
        defaultdict(<type 'dict'>, {'thing': 42})

    """

    def __init__(self, keypath):
        path, _, self.key = keypath.rpartition('.')
        self.path = path.split('.') if path else None

    def _path(self, obj):
        return (reduce(lambda d, k: d[k], [obj] + self.path) if self.path
                else obj)

    def __get__(self, obj, type=None):
        if obj is None:
            return type
        return self._path(obj).get(self.key)

    def __set__(self, obj, value):
        self._path(obj)[self.key] = value


def maybe_unroll_group(g):
    """Unroll group with only one member."""
    # Issue #1656
    try:
        size = len(g.tasks)
    except TypeError:
        try:
            size = g.tasks.__length_hint__()
        except (AttributeError, TypeError):
            pass
        else:
            return list(g.tasks)[0] if size == 1 else g
    else:
        return g.tasks[0] if size == 1 else g


def _upgrade(fields, sig):
    """Used by custom signatures in .from_dict, to keep common fields."""
    sig.update(chord_size=fields.get('chord_size'))
    return sig


class Signature(dict):
    """Class that wraps the arguments and execution options
    for a single task invocation.

    Used as the parts in a :class:`group` and other constructs,
    or to pass tasks around as callbacks while being compatible
    with serializers with a strict type subset.

    :param task: Either a task class/instance, or the name of a task.
    :keyword args: Positional arguments to apply.
    :keyword kwargs: Keyword arguments to apply.
    :keyword options: Additional options to :meth:`Task.apply_async`.

    Note that if the first argument is a :class:`dict`, the other
    arguments will be ignored and the values in the dict will be used
    instead.

        >>> s = signature('tasks.add', args=(2, 2))
        >>> signature(s)
        {'task': 'tasks.add', args=(2, 2), kwargs={}, options={}}

    """
    TYPES = {}
    _app = _type = None

    @classmethod
    def register_type(cls, subclass, name=None):
        cls.TYPES[name or subclass.__name__] = subclass
        return subclass

    @classmethod
    def from_dict(self, d, app=None):
        typ = d.get('subtask_type')
        if typ:
            return self.TYPES[typ].from_dict(kwdict(d), app=app)
        return Signature(d, app=app)

    def __init__(self, task=None, args=None, kwargs=None, options=None,
                 type=None, subtask_type=None, immutable=False,
                 app=None, **ex):
        self._app = app
        init = dict.__init__

        if isinstance(task, dict):
            return init(self, task)  # works like dict(d)

        # Also supports using task class/instance instead of string name.
        try:
            task_name = task.name
        except AttributeError:
            task_name = task
        else:
            self._type = task

        init(self,
             task=task_name, args=tuple(args or ()),
             kwargs=kwargs or {},
             options=dict(options or {}, **ex),
             subtask_type=subtask_type,
             immutable=immutable,
             chord_size=None)

    def __call__(self, *partial_args, **partial_kwargs):
        args, kwargs, _ = self._merge(partial_args, partial_kwargs, None)
        return self.type(*args, **kwargs)

    def delay(self, *partial_args, **partial_kwargs):
        return self.apply_async(partial_args, partial_kwargs)

    def apply(self, args=(), kwargs={}, **options):
        """Apply this task locally."""
        # For callbacks: extra args are prepended to the stored args.
        args, kwargs, options = self._merge(args, kwargs, options)
        return self.type.apply(args, kwargs, **options)

    def _merge(self, args=(), kwargs={}, options={}):
        if self.immutable:
            return (self.args, self.kwargs,
                    dict(self.options, **options) if options else self.options)
        return (tuple(args) + tuple(self.args) if args else self.args,
                dict(self.kwargs, **kwargs) if kwargs else self.kwargs,
                dict(self.options, **options) if options else self.options)

    def clone(self, args=(), kwargs={}, app=None, **opts):
        # need to deepcopy options so origins links etc. is not modified.
        if args or kwargs or opts:
            args, kwargs, opts = self._merge(args, kwargs, opts)
        else:
            args, kwargs, opts = self.args, self.kwargs, self.options
        s = Signature.from_dict({'task': self.task, 'args': tuple(args),
                                 'kwargs': kwargs, 'options': deepcopy(opts),
                                 'subtask_type': self.subtask_type,
                                 'chord_size': self.chord_size,
                                 'immutable': self.immutable},
                                app=app or self._app)
        s._type = self._type
        return s
    partial = clone

    def freeze(self, _id=None, group_id=None, chord=None):
        opts = self.options
        try:
            tid = opts['task_id']
        except KeyError:
            tid = opts['task_id'] = _id or uuid()
        if 'reply_to' not in opts:
            opts['reply_to'] = self.app.oid
        if group_id:
            opts['group_id'] = group_id
        if chord:
            opts['chord'] = chord
        return self.app.AsyncResult(tid)
    _freeze = freeze

    def replace(self, args=None, kwargs=None, options=None):
        s = self.clone()
        if args is not None:
            s.args = args
        if kwargs is not None:
            s.kwargs = kwargs
        if options is not None:
            s.options = options
        return s

    def set(self, immutable=None, **options):
        if immutable is not None:
            self.set_immutable(immutable)
        self.options.update(options)
        return self

    def set_immutable(self, immutable):
        self.immutable = immutable

    def apply_async(self, args=(), kwargs={}, **options):
        try:
            _apply = self._apply_async
        except IndexError:  # no tasks for chain, etc to find type
            return
        # For callbacks: extra args are prepended to the stored args.
        if args or kwargs or options:
            args, kwargs, options = self._merge(args, kwargs, options)
        else:
            args, kwargs, options = self.args, self.kwargs, self.options
        return _apply(args, kwargs, **options)

    def append_to_list_option(self, key, value):
        items = self.options.setdefault(key, [])
        if not isinstance(items, MutableSequence):
            items = self.options[key] = [items]
        if value not in items:
            items.append(value)
        return value

    def link(self, callback):
        return self.append_to_list_option('link', callback)

    def link_error(self, errback):
        return self.append_to_list_option('link_error', errback)

    def flatten_links(self):
        return list(_chain.from_iterable(_chain(
            [[self]],
            (link.flatten_links()
                for link in maybe_list(self.options.get('link')) or [])
        )))

    def __or__(self, other):
        if isinstance(other, group):
            other = maybe_unroll_group(other)
        if not isinstance(self, chain) and isinstance(other, chain):
            return chain((self, ) + other.tasks, app=self._app)
        elif isinstance(other, chain):
            return chain(*self.tasks + other.tasks, app=self._app)
        elif isinstance(other, Signature):
            if isinstance(self, chain):
                return chain(*self.tasks + (other, ), app=self._app)
            return chain(self, other, app=self._app)
        return NotImplemented

    def __deepcopy__(self, memo):
        memo[id(self)] = self
        return dict(self)

    def __invert__(self):
        return self.apply_async().get()

    def __reduce__(self):
        # for serialization, the task type is lazily loaded,
        # and not stored in the dict itself.
        return subtask, (dict(self), )

    def reprcall(self, *args, **kwargs):
        args, kwargs, _ = self._merge(args, kwargs, {})
        return reprcall(self['task'], args, kwargs)

    def election(self):
        type = self.type
        app = type.app
        tid = self.options.get('task_id') or uuid()

        with app.producer_or_acquire(None) as P:
            props = type.backend.on_task_call(P, tid)
            app.control.election(tid, 'task', self.clone(task_id=tid, **props),
                                 connection=P.connection)
            return type.AsyncResult(tid)

    def __repr__(self):
        return self.reprcall()

    @cached_property
    def type(self):
        return self._type or self.app.tasks[self['task']]

    @cached_property
    def app(self):
        return self._app or current_app

    @cached_property
    def AsyncResult(self):
        try:
            return self.type.AsyncResult
        except KeyError:  # task not registered
            return self.app.AsyncResult

    @cached_property
    def _apply_async(self):
        try:
            return self.type.apply_async
        except KeyError:
            return _partial(self.app.send_task, self['task'])
    id = _getitem_property('options.task_id')
    task = _getitem_property('task')
    args = _getitem_property('args')
    kwargs = _getitem_property('kwargs')
    options = _getitem_property('options')
    subtask_type = _getitem_property('subtask_type')
    chord_size = _getitem_property('chord_size')
    immutable = _getitem_property('immutable')


@Signature.register_type
class chain(Signature):

    def __init__(self, *tasks, **options):
        tasks = (regen(tasks[0]) if len(tasks) == 1 and is_list(tasks[0])
                 else tasks)
        Signature.__init__(
            self, 'celery.chain', (), {'tasks': tasks}, **options
        )
        self.tasks = tasks
        self.subtask_type = 'chain'

    def __call__(self, *args, **kwargs):
        if self.tasks:
            return self.apply_async(args, kwargs)

    @classmethod
    def from_dict(self, d, app=None):
        tasks = [maybe_signature(t, app=app) for t in d['kwargs']['tasks']]
        if d['args'] and tasks:
            # partial args passed on to first task in chain (Issue #1057).
            tasks[0]['args'] = tasks[0]._merge(d['args'])[0]
        return _upgrade(d, chain(*tasks, app=app, **d['options']))

    @property
    def type(self):
        try:
            return self._type or self.tasks[0].type.app.tasks['celery.chain']
        except KeyError:
            return self.app.tasks['celery.chain']

    def __repr__(self):
        return ' | '.join(repr(t) for t in self.tasks)


class _basemap(Signature):
    _task_name = None
    _unpack_args = itemgetter('task', 'it')

    def __init__(self, task, it, **options):
        Signature.__init__(
            self, self._task_name, (),
            {'task': task, 'it': regen(it)}, immutable=True, **options
        )

    def apply_async(self, args=(), kwargs={}, **opts):
        # need to evaluate generators
        task, it = self._unpack_args(self.kwargs)
        return self.type.apply_async(
            (), {'task': task, 'it': list(it)}, **opts
        )

    @classmethod
    def from_dict(cls, d, app=None):
        return _upgrade(
            d, cls(*cls._unpack_args(d['kwargs']), app=app, **d['options']),
        )


@Signature.register_type
class xmap(_basemap):
    _task_name = 'celery.map'

    def __repr__(self):
        task, it = self._unpack_args(self.kwargs)
        return '[{0}(x) for x in {1}]'.format(task.task,
                                              truncate(repr(it), 100))


@Signature.register_type
class xstarmap(_basemap):
    _task_name = 'celery.starmap'

    def __repr__(self):
        task, it = self._unpack_args(self.kwargs)
        return '[{0}(*x) for x in {1}]'.format(task.task,
                                               truncate(repr(it), 100))


@Signature.register_type
class chunks(Signature):
    _unpack_args = itemgetter('task', 'it', 'n')

    def __init__(self, task, it, n, **options):
        Signature.__init__(
            self, 'celery.chunks', (),
            {'task': task, 'it': regen(it), 'n': n},
            immutable=True, **options
        )

    @classmethod
    def from_dict(self, d, app=None):
        return _upgrade(
            d, chunks(*self._unpack_args(
                d['kwargs']), app=app, **d['options']),
        )

    def apply_async(self, args=(), kwargs={}, **opts):
        return self.group().apply_async(args, kwargs, **opts)

    def __call__(self, **options):
        return self.group()(**options)

    def group(self):
        # need to evaluate generators
        task, it, n = self._unpack_args(self.kwargs)
        return group((xstarmap(task, part, app=self._app)
                      for part in _chunks(iter(it), n)),
                     app=self._app)

    @classmethod
    def apply_chunks(cls, task, it, n, app=None):
        return cls(task, it, n, app=app)()


def _maybe_group(tasks):
    if isinstance(tasks, group):
        tasks = list(tasks.tasks)
    elif isinstance(tasks, Signature):
        tasks = [tasks]
    else:
        tasks = regen(tasks)
    return tasks


def _maybe_clone(tasks, app):
    return [s.clone() if isinstance(s, Signature) else signature(s, app=app)
            for s in tasks]


@Signature.register_type
class group(Signature):

    def __init__(self, *tasks, **options):
        if len(tasks) == 1:
            tasks = _maybe_group(tasks[0])
        Signature.__init__(
            self, 'celery.group', (), {'tasks': tasks}, **options
        )
        self.tasks, self.subtask_type = tasks, 'group'

    @classmethod
    def from_dict(self, d, app=None):
        tasks = [maybe_signature(t, app=app) for t in d['kwargs']['tasks']]
        if d['args'] and tasks:
            # partial args passed on to all tasks in the group (Issue #1057).
            for task in tasks:
                task['args'] = task._merge(d['args'])[0]
        return _upgrade(d, group(tasks, app=app, **kwdict(d['options'])))

    def apply_async(self, args=(), kwargs=None, add_to_parent=True, **options):
        tasks = _maybe_clone(self.tasks, app=self._app)
        if not tasks:
            return self.freeze()
        type = self.type
        return type(*type.prepare(dict(self.options, **options), tasks, args),
                    add_to_parent=add_to_parent)

    def set_immutable(self, immutable):
        for task in self.tasks:
            task.set_immutable(immutable)

    def link(self, sig):
        # Simply link to first task
        sig = sig.clone().set(immutable=True)
        return self.tasks[0].link(sig)

    def link_error(self, sig):
        sig = sig.clone().set(immutable=True)
        return self.tasks[0].link_error(sig)

    def apply(self, *args, **kwargs):
        if not self.tasks:
            return self.freeze()  # empty group returns GroupResult
        return Signature.apply(self, *args, **kwargs)

    def __call__(self, *partial_args, **options):
        return self.apply_async(partial_args, **options)

    def freeze(self, _id=None, group_id=None, chord=None):
        opts = self.options
        try:
            gid = opts['task_id']
        except KeyError:
            gid = opts['task_id'] = uuid()
        if group_id:
            opts['group_id'] = group_id
        if chord:
            opts['chord'] = group_id
        new_tasks, results = [], []
        for task in self.tasks:
            task = maybe_signature(task, app=self._app).clone()
            results.append(task.freeze(group_id=group_id, chord=chord))
            new_tasks.append(task)
        self.tasks = self.kwargs['tasks'] = new_tasks
        return self.app.GroupResult(gid, results)
    _freeze = freeze

    def skew(self, start=1.0, stop=None, step=1.0):
        it = fxrange(start, stop, step, repeatlast=True)
        for task in self.tasks:
            task.set(countdown=next(it))
        return self

    def __iter__(self):
        return iter(self.tasks)

    def __repr__(self):
        return repr(self.tasks)

    @property
    def app(self):
        return self._app or (self.tasks[0].app if self.tasks else current_app)

    @property
    def type(self):
        if self._type:
            return self._type
        # taking the app from the first task in the list, there may be a
        # better solution for this, e.g. to consolidate tasks with the same
        # app and apply them in batches.
        return self.app.tasks[self['task']]


@Signature.register_type
class chord(Signature):

    def __init__(self, header, body=None, task='celery.chord',
                 args=(), kwargs={}, **options):
        Signature.__init__(
            self, task, args,
            dict(kwargs, header=_maybe_group(header),
                 body=maybe_signature(body, app=self._app)), **options
        )
        self.subtask_type = 'chord'

    def apply(self, args=(), kwargs={}, **options):
        # For callbacks: extra args are prepended to the stored args.
        args, kwargs, options = self._merge(args, kwargs, options)
        return self.type.apply(args, kwargs, **options)

    def freeze(self, _id=None, group_id=None, chord=None):
        return self.body.freeze(_id, group_id=group_id, chord=chord)

    @classmethod
    def from_dict(self, d, app=None):
        args, d['kwargs'] = self._unpack_args(**kwdict(d['kwargs']))
        return _upgrade(d, self(*args, app=app, **kwdict(d)))

    @staticmethod
    def _unpack_args(header=None, body=None, **kwargs):
        # Python signatures are better at extracting keys from dicts
        # than manually popping things off.
        return (header, body), kwargs

    @property
    def app(self):
        # we will be able to fix this mess in 3.2 when we no longer
        # require an actual task implementation for chord/group
        if self._app:
            return self._app
        app = None if self.body is None else self.body.app
        if app is None:
            try:
                app = self.tasks[0].app
            except IndexError:
                app = None
        return app if app is not None else current_app

    @property
    def type(self):
        if self._type:
            return self._type
        return self.app.tasks['celery.chord']

    def delay(self, *partial_args, **partial_kwargs):
        # There's no partial_kwargs for chord.
        return self.apply_async(partial_args)

    def apply_async(self, args=(), kwargs={}, task_id=None,
                    producer=None, publisher=None, connection=None,
                    router=None, result_cls=None, **options):
        args = (tuple(args) + tuple(self.args)
                if args and not self.immutable else self.args)
        body = kwargs.get('body') or self.kwargs['body']
        kwargs = dict(self.kwargs, **kwargs)
        body = body.clone(**options)

        _chord = self.type
        if _chord.app.conf.CELERY_ALWAYS_EAGER:
            return self.apply(args, kwargs, task_id=task_id, **options)
        res = body.freeze(task_id)
        parent = _chord(self.tasks, body, args, **options)
        res.parent = parent
        return res

    def __call__(self, body=None, **options):
        return self.apply_async(
            (), {'body': body} if body else {}, **options)

    def clone(self, *args, **kwargs):
        s = Signature.clone(self, *args, **kwargs)
        # need to make copy of body
        try:
            s.kwargs['body'] = s.kwargs['body'].clone()
        except (AttributeError, KeyError):
            pass
        return s

    def link(self, callback):
        self.body.link(callback)
        return callback

    def link_error(self, errback):
        self.body.link_error(errback)
        return errback

    def set_immutable(self, immutable):
        # changes mutability of header only, not callback.
        for task in self.tasks:
            task.set_immutable(immutable)

    def __repr__(self):
        if self.body:
            return self.body.reprcall(self.tasks)
        return '<chord without body: {0.tasks!r}>'.format(self)

    tasks = _getitem_property('kwargs.header')
    body = _getitem_property('kwargs.body')


def signature(varies, args=(), kwargs={}, options={}, app=None, **kw):
    if isinstance(varies, dict):
        if isinstance(varies, Signature):
            return varies.clone(app=app)
        return Signature.from_dict(varies, app=app)
    return Signature(varies, args, kwargs, options, app=app, **kw)
subtask = signature   # XXX compat


def maybe_signature(d, app=None):
    if d is not None:
        if isinstance(d, dict):
            if not isinstance(d, Signature):
                return signature(d, app=app)
        elif isinstance(d, list):
            return [maybe_signature(s, app=app) for s in d]
        if app is not None:
            d._app = app
        return d
maybe_subtask = maybe_signature  # XXX compat
