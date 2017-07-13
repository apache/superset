# -*- coding: utf-8 -*-
"""
    celery.datastructures
    ~~~~~~~~~~~~~~~~~~~~~

    Custom types and data structures.

"""
from __future__ import absolute_import, print_function, unicode_literals

import sys
import time

from collections import defaultdict, Mapping, MutableMapping, MutableSet
from heapq import heapify, heappush, heappop
from functools import partial
from itertools import chain

from billiard.einfo import ExceptionInfo  # noqa
from kombu.utils.encoding import safe_str
from kombu.utils.limits import TokenBucket  # noqa

from celery.five import items
from celery.utils.functional import LRUCache, first, uniq  # noqa

try:
    from django.utils.functional import LazyObject, LazySettings
except ImportError:
    class LazyObject(object):  # noqa
        pass
    LazySettings = LazyObject  # noqa

DOT_HEAD = """
{IN}{type} {id} {{
{INp}graph [{attrs}]
"""
DOT_ATTR = '{name}={value}'
DOT_NODE = '{INp}"{0}" [{attrs}]'
DOT_EDGE = '{INp}"{0}" {dir} "{1}" [{attrs}]'
DOT_ATTRSEP = ', '
DOT_DIRS = {'graph': '--', 'digraph': '->'}
DOT_TAIL = '{IN}}}'

__all__ = ['GraphFormatter', 'CycleError', 'DependencyGraph',
           'AttributeDictMixin', 'AttributeDict', 'DictAttribute',
           'ConfigurationView', 'LimitedSet']


def force_mapping(m):
    if isinstance(m, (LazyObject, LazySettings)):
        m = m._wrapped
    return DictAttribute(m) if not isinstance(m, Mapping) else m


class GraphFormatter(object):
    _attr = DOT_ATTR.strip()
    _node = DOT_NODE.strip()
    _edge = DOT_EDGE.strip()
    _head = DOT_HEAD.strip()
    _tail = DOT_TAIL.strip()
    _attrsep = DOT_ATTRSEP
    _dirs = dict(DOT_DIRS)

    scheme = {
        'shape': 'box',
        'arrowhead': 'vee',
        'style': 'filled',
        'fontname': 'HelveticaNeue',
    }
    edge_scheme = {
        'color': 'darkseagreen4',
        'arrowcolor': 'black',
        'arrowsize': 0.7,
    }
    node_scheme = {'fillcolor': 'palegreen3', 'color': 'palegreen4'}
    term_scheme = {'fillcolor': 'palegreen1', 'color': 'palegreen2'}
    graph_scheme = {'bgcolor': 'mintcream'}

    def __init__(self, root=None, type=None, id=None,
                 indent=0, inw=' ' * 4, **scheme):
        self.id = id or 'dependencies'
        self.root = root
        self.type = type or 'digraph'
        self.direction = self._dirs[self.type]
        self.IN = inw * (indent or 0)
        self.INp = self.IN + inw
        self.scheme = dict(self.scheme, **scheme)
        self.graph_scheme = dict(self.graph_scheme, root=self.label(self.root))

    def attr(self, name, value):
        value = '"{0}"'.format(value)
        return self.FMT(self._attr, name=name, value=value)

    def attrs(self, d, scheme=None):
        d = dict(self.scheme, **dict(scheme, **d or {}) if scheme else d)
        return self._attrsep.join(
            safe_str(self.attr(k, v)) for k, v in items(d)
        )

    def head(self, **attrs):
        return self.FMT(
            self._head, id=self.id, type=self.type,
            attrs=self.attrs(attrs, self.graph_scheme),
        )

    def tail(self):
        return self.FMT(self._tail)

    def label(self, obj):
        return obj

    def node(self, obj, **attrs):
        return self.draw_node(obj, self.node_scheme, attrs)

    def terminal_node(self, obj, **attrs):
        return self.draw_node(obj, self.term_scheme, attrs)

    def edge(self, a, b, **attrs):
        return self.draw_edge(a, b, **attrs)

    def _enc(self, s):
        return s.encode('utf-8', 'ignore')

    def FMT(self, fmt, *args, **kwargs):
        return self._enc(fmt.format(
            *args, **dict(kwargs, IN=self.IN, INp=self.INp)
        ))

    def draw_edge(self, a, b, scheme=None, attrs=None):
        return self.FMT(
            self._edge, self.label(a), self.label(b),
            dir=self.direction, attrs=self.attrs(attrs, self.edge_scheme),
        )

    def draw_node(self, obj, scheme=None, attrs=None):
        return self.FMT(
            self._node, self.label(obj), attrs=self.attrs(attrs, scheme),
        )


class CycleError(Exception):
    """A cycle was detected in an acyclic graph."""


class DependencyGraph(object):
    """A directed acyclic graph of objects and their dependencies.

    Supports a robust topological sort
    to detect the order in which they must be handled.

    Takes an optional iterator of ``(obj, dependencies)``
    tuples to build the graph from.

    .. warning::

        Does not support cycle detection.

    """

    def __init__(self, it=None, formatter=None):
        self.formatter = formatter or GraphFormatter()
        self.adjacent = {}
        if it is not None:
            self.update(it)

    def add_arc(self, obj):
        """Add an object to the graph."""
        self.adjacent.setdefault(obj, [])

    def add_edge(self, A, B):
        """Add an edge from object ``A`` to object ``B``
        (``A`` depends on ``B``)."""
        self[A].append(B)

    def connect(self, graph):
        """Add nodes from another graph."""
        self.adjacent.update(graph.adjacent)

    def topsort(self):
        """Sort the graph topologically.

        :returns: a list of objects in the order
            in which they must be handled.

        """
        graph = DependencyGraph()
        components = self._tarjan72()

        NC = dict((node, component)
                  for component in components
                  for node in component)
        for component in components:
            graph.add_arc(component)
        for node in self:
            node_c = NC[node]
            for successor in self[node]:
                successor_c = NC[successor]
                if node_c != successor_c:
                    graph.add_edge(node_c, successor_c)
        return [t[0] for t in graph._khan62()]

    def valency_of(self, obj):
        """Return the valency (degree) of a vertex in the graph."""
        try:
            l = [len(self[obj])]
        except KeyError:
            return 0
        for node in self[obj]:
            l.append(self.valency_of(node))
        return sum(l)

    def update(self, it):
        """Update the graph with data from a list
        of ``(obj, dependencies)`` tuples."""
        tups = list(it)
        for obj, _ in tups:
            self.add_arc(obj)
        for obj, deps in tups:
            for dep in deps:
                self.add_edge(obj, dep)

    def edges(self):
        """Return generator that yields for all edges in the graph."""
        return (obj for obj, adj in items(self) if adj)

    def _khan62(self):
        """Khans simple topological sort algorithm from '62

        See http://en.wikipedia.org/wiki/Topological_sorting

        """
        count = defaultdict(lambda: 0)
        result = []

        for node in self:
            for successor in self[node]:
                count[successor] += 1
        ready = [node for node in self if not count[node]]

        while ready:
            node = ready.pop()
            result.append(node)

            for successor in self[node]:
                count[successor] -= 1
                if count[successor] == 0:
                    ready.append(successor)
        result.reverse()
        return result

    def _tarjan72(self):
        """Tarjan's algorithm to find strongly connected components.

        See http://bit.ly/vIMv3h.

        """
        result, stack, low = [], [], {}

        def visit(node):
            if node in low:
                return
            num = len(low)
            low[node] = num
            stack_pos = len(stack)
            stack.append(node)

            for successor in self[node]:
                visit(successor)
                low[node] = min(low[node], low[successor])

            if num == low[node]:
                component = tuple(stack[stack_pos:])
                stack[stack_pos:] = []
                result.append(component)
                for item in component:
                    low[item] = len(self)

        for node in self:
            visit(node)

        return result

    def to_dot(self, fh, formatter=None):
        """Convert the graph to DOT format.

        :param fh: A file, or a file-like object to write the graph to.

        """
        seen = set()
        draw = formatter or self.formatter
        P = partial(print, file=fh)

        def if_not_seen(fun, obj):
            if draw.label(obj) not in seen:
                P(fun(obj))
                seen.add(draw.label(obj))

        P(draw.head())
        for obj, adjacent in items(self):
            if not adjacent:
                if_not_seen(draw.terminal_node, obj)
            for req in adjacent:
                if_not_seen(draw.node, obj)
                P(draw.edge(obj, req))
        P(draw.tail())

    def format(self, obj):
        return self.formatter(obj) if self.formatter else obj

    def __iter__(self):
        return iter(self.adjacent)

    def __getitem__(self, node):
        return self.adjacent[node]

    def __len__(self):
        return len(self.adjacent)

    def __contains__(self, obj):
        return obj in self.adjacent

    def _iterate_items(self):
        return items(self.adjacent)
    items = iteritems = _iterate_items

    def __repr__(self):
        return '\n'.join(self.repr_node(N) for N in self)

    def repr_node(self, obj, level=1, fmt='{0}({1})'):
        output = [fmt.format(obj, self.valency_of(obj))]
        if obj in self:
            for other in self[obj]:
                d = fmt.format(other, self.valency_of(other))
                output.append('     ' * level + d)
                output.extend(self.repr_node(other, level + 1).split('\n')[1:])
        return '\n'.join(output)


class AttributeDictMixin(object):
    """Augment classes with a Mapping interface by adding attribute access.

    I.e. `d.key -> d[key]`.

    """

    def __getattr__(self, k):
        """`d.key -> d[key]`"""
        try:
            return self[k]
        except KeyError:
            raise AttributeError(
                '{0!r} object has no attribute {1!r}'.format(
                    type(self).__name__, k))

    def __setattr__(self, key, value):
        """`d[key] = value -> d.key = value`"""
        self[key] = value


class AttributeDict(dict, AttributeDictMixin):
    """Dict subclass with attribute access."""
    pass


class DictAttribute(object):
    """Dict interface to attributes.

    `obj[k] -> obj.k`
    `obj[k] = val -> obj.k = val`

    """
    obj = None

    def __init__(self, obj):
        object.__setattr__(self, 'obj', obj)

    def __getattr__(self, key):
        return getattr(self.obj, key)

    def __setattr__(self, key, value):
        return setattr(self.obj, key, value)

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def setdefault(self, key, default):
        try:
            return self[key]
        except KeyError:
            self[key] = default
            return default

    def __getitem__(self, key):
        try:
            return getattr(self.obj, key)
        except AttributeError:
            raise KeyError(key)

    def __setitem__(self, key, value):
        setattr(self.obj, key, value)

    def __contains__(self, key):
        return hasattr(self.obj, key)

    def _iterate_keys(self):
        return iter(dir(self.obj))
    iterkeys = _iterate_keys

    def __iter__(self):
        return self._iterate_keys()

    def _iterate_items(self):
        for key in self._iterate_keys():
            yield key, getattr(self.obj, key)
    iteritems = _iterate_items

    def _iterate_values(self):
        for key in self._iterate_keys():
            yield getattr(self.obj, key)
    itervalues = _iterate_values

    if sys.version_info[0] == 3:  # pragma: no cover
        items = _iterate_items
        keys = _iterate_keys
        values = _iterate_values
    else:

        def keys(self):
            return list(self)

        def items(self):
            return list(self._iterate_items())

        def values(self):
            return list(self._iterate_values())
MutableMapping.register(DictAttribute)


class ConfigurationView(AttributeDictMixin):
    """A view over an applications configuration dicts.

    Custom (but older) version of :class:`collections.ChainMap`.

    If the key does not exist in ``changes``, the ``defaults`` dicts
    are consulted.

    :param changes:  Dict containing changes to the configuration.
    :param defaults: List of dicts containing the default configuration.

    """
    changes = None
    defaults = None
    _order = None

    def __init__(self, changes, defaults):
        self.__dict__.update(changes=changes, defaults=defaults,
                             _order=[changes] + defaults)

    def add_defaults(self, d):
        d = force_mapping(d)
        self.defaults.insert(0, d)
        self._order.insert(1, d)

    def __getitem__(self, key):
        for d in self._order:
            try:
                return d[key]
            except KeyError:
                pass
        raise KeyError(key)

    def __setitem__(self, key, value):
        self.changes[key] = value

    def first(self, *keys):
        return first(None, (self.get(key) for key in keys))

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def clear(self):
        """Remove all changes, but keep defaults."""
        self.changes.clear()

    def setdefault(self, key, default):
        try:
            return self[key]
        except KeyError:
            self[key] = default
            return default

    def update(self, *args, **kwargs):
        return self.changes.update(*args, **kwargs)

    def __contains__(self, key):
        return any(key in m for m in self._order)

    def __bool__(self):
        return any(self._order)
    __nonzero__ = __bool__  # Py2

    def __repr__(self):
        return repr(dict(items(self)))

    def __iter__(self):
        return self._iterate_keys()

    def __len__(self):
        # The logic for iterating keys includes uniq(),
        # so to be safe we count by explicitly iterating
        return len(set().union(*self._order))

    def _iter(self, op):
        # defaults must be first in the stream, so values in
        # changes takes precedence.
        return chain(*[op(d) for d in reversed(self._order)])

    def _iterate_keys(self):
        return uniq(self._iter(lambda d: d))
    iterkeys = _iterate_keys

    def _iterate_items(self):
        return ((key, self[key]) for key in self)
    iteritems = _iterate_items

    def _iterate_values(self):
        return (self[key] for key in self)
    itervalues = _iterate_values

    if sys.version_info[0] == 3:  # pragma: no cover
        keys = _iterate_keys
        items = _iterate_items
        values = _iterate_values

    else:  # noqa
        def keys(self):
            return list(self._iterate_keys())

        def items(self):
            return list(self._iterate_items())

        def values(self):
            return list(self._iterate_values())

MutableMapping.register(ConfigurationView)


class LimitedSet(object):
    """Kind-of Set with limitations.

    Good for when you need to test for membership (`a in set`),
    but the set should not grow unbounded.

    :keyword maxlen: Maximum number of members before we start
                     evicting expired members.
    :keyword expires: Time in seconds, before a membership expires.

    """

    def __init__(self, maxlen=None, expires=None, data=None, heap=None):
        # heap is ignored
        self.maxlen = maxlen
        self.expires = expires
        self._data = {} if data is None else data
        self._heap = []

        # make shortcuts
        self.__len__ = self._heap.__len__
        self.__contains__ = self._data.__contains__

        self._refresh_heap()

    def _refresh_heap(self):
        self._heap[:] = [(t, key) for key, t in items(self._data)]
        heapify(self._heap)

    def add(self, key, now=time.time, heappush=heappush):
        """Add a new member."""
        # offset is there to modify the length of the list,
        # this way we can expire an item before inserting the value,
        # and it will end up in the correct order.
        self.purge(1, offset=1)
        inserted = now()
        self._data[key] = inserted
        heappush(self._heap, (inserted, key))

    def clear(self):
        """Remove all members"""
        self._data.clear()
        self._heap[:] = []

    def discard(self, value):
        """Remove membership by finding value."""
        try:
            itime = self._data[value]
        except KeyError:
            return
        try:
            self._heap.remove((itime, value))
        except ValueError:
            pass
        self._data.pop(value, None)
    pop_value = discard  # XXX compat

    def purge(self, limit=None, offset=0, now=time.time):
        """Purge expired items."""
        H, maxlen = self._heap, self.maxlen
        if not maxlen:
            return

        # If the data/heap gets corrupted and limit is None
        # this will go into an infinite loop, so limit must
        # have a value to guard the loop.
        limit = len(self) + offset if limit is None else limit

        i = 0
        while len(self) + offset > maxlen:
            if i >= limit:
                break
            try:
                item = heappop(H)
            except IndexError:
                break
            if self.expires:
                if now() < item[0] + self.expires:
                    heappush(H, item)
                    break
            try:
                self._data.pop(item[1])
            except KeyError:  # out of sync with heap
                pass
            i += 1

    def update(self, other):
        if isinstance(other, LimitedSet):
            self._data.update(other._data)
            self._refresh_heap()
        else:
            for obj in other:
                self.add(obj)

    def as_dict(self):
        return self._data

    def __eq__(self, other):
        return self._heap == other._heap

    def __ne__(self, other):
        return not self.__eq__(other)

    def __repr__(self):
        return 'LimitedSet({0})'.format(len(self))

    def __iter__(self):
        return (item[1] for item in self._heap)

    def __len__(self):
        return len(self._heap)

    def __contains__(self, key):
        return key in self._data

    def __reduce__(self):
        return self.__class__, (self.maxlen, self.expires, self._data)
MutableSet.register(LimitedSet)
