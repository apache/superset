"""
>>> hasattr(entry_points(), 'select')
True
>>> tuple(entry_points(group='console_scripts'))
(...)

Some usage is deprecated and may emit deprecation warnings
on later versions.

>>> import warnings
>>> warnings.filterwarnings('ignore', category=DeprecationWarning)

>>> entry_points()['console_scripts'][0]
EntryPoint...(...)
"""

import collections
import textwrap
import itertools
import operator
import functools

try:
    from itertools import filterfalse  # type: ignore
except ImportError:
    from itertools import ifilterfalse as filterfalse  # type: ignore


try:
    # prefer importlib_metadata if it has EntryPoints
    import importlib_metadata as metadata  # type: ignore

    if not hasattr(metadata, 'EntryPoints'):
        raise ImportError("package without EntryPoints")
    from importlib_metadata import distributions, EntryPoint  # type: ignore
except ImportError:
    try:
        import importlib.metadata as metadata  # type: ignore
        from importlib.metadata import distributions, EntryPoint  # type: ignore
    except ImportError:
        from importlib_metadata import distributions, EntryPoint  # type: ignore


__all__ = ['entry_points']


def unique_everseen(iterable, key=None):
    "List unique elements, preserving order. Remember all elements ever seen."
    # unique_everseen('AAAABBBCCDAABBB') --> A B C D
    # unique_everseen('ABBCcAD', str.lower) --> A B C D
    seen = set()
    seen_add = seen.add
    if key is None:
        for element in filterfalse(seen.__contains__, iterable):
            seen_add(element)
            yield element
    else:
        for element in iterable:
            k = key(element)
            if k not in seen:
                seen_add(k)
                yield element


class Pair(collections.namedtuple('Pair', 'name value')):
    @classmethod
    def parse(cls, text):
        return cls(*map(str.strip, text.split("=", 1)))


class Sectioned:
    """
    A simple entry point config parser for performance

    >>> for item in Sectioned.read(Sectioned._sample):
    ...     print(item)
    Pair(name='sec1', value='# comments ignored')
    Pair(name='sec1', value='a = 1')
    Pair(name='sec1', value='b = 2')
    Pair(name='sec2', value='a = 2')

    >>> res = Sectioned.section_pairs(Sectioned._sample)
    >>> item = next(res)
    >>> item.name
    'sec1'
    >>> item.value
    Pair(name='a', value='1')
    >>> item = next(res)
    >>> item.value
    Pair(name='b', value='2')
    >>> item = next(res)
    >>> item.name
    'sec2'
    >>> item.value
    Pair(name='a', value='2')
    >>> list(res)
    []
    """

    _sample = textwrap.dedent(
        """
        [sec1]
        # comments ignored
        a = 1
        b = 2

        [sec2]
        a = 2
        """
    ).lstrip()

    @classmethod
    def section_pairs(cls, text):
        return (
            section._replace(value=Pair.parse(section.value))
            for section in cls.read(text, filter_=cls.valid)
            if section.name is not None
        )

    @staticmethod
    def read(text, filter_=None):
        lines = filter(filter_, map(str.strip, text.splitlines()))
        name = None
        for value in lines:
            section_match = value.startswith('[') and value.endswith(']')
            if section_match:
                name = value.strip('[]')
                continue
            yield Pair(name, value)

    @staticmethod
    def valid(line):
        return line and not line.startswith('#')


def compat_matches(ep, **params):
    try:
        return ep.matches(**params)
    except AttributeError:
        pass
    attrs = (getattr(ep, param) for param in params)
    return all(map(operator.eq, params.values(), attrs))


class EntryPoints(list):
    """
    An immutable collection of selectable EntryPoint objects.
    """

    __slots__ = ()

    def __getitem__(self, name):  # -> EntryPoint:
        """
        Get the EntryPoint in self matching name.
        """
        if isinstance(name, int):
            return super(EntryPoints, self).__getitem__(name)
        try:
            return next(iter(self.select(name=name)))
        except StopIteration:
            raise KeyError(name)

    def select(self, **params):
        """
        Select entry points from self that match the
        given parameters (typically group and/or name).
        """
        return EntryPoints(ep for ep in self if compat_matches(ep, **params))

    @property
    def names(self):
        """
        Return the set of all names of all entry points.
        """
        return set(ep.name for ep in self)

    @property
    def groups(self):
        """
        Return the set of all groups of all entry points.

        For coverage while SelectableGroups is present.
        >>> EntryPoints().groups
        set(...)
        """
        return set(ep.group for ep in self)

    @classmethod
    def _from_text_for(cls, text, dist):
        return cls(ep._for(dist) for ep in cls._from_text(text))

    @classmethod
    def _from_text(cls, text):
        return itertools.starmap(EntryPoint, cls._parse_groups(text or ''))

    @staticmethod
    def _parse_groups(text):
        return (
            (item.value.name, item.value.value, item.name)
            for item in Sectioned.section_pairs(text)
        )


class SelectableGroups(dict):
    """
    A backward- and forward-compatible result from
    entry_points that fully implements the dict interface.
    """

    @classmethod
    def load(cls, eps):
        by_group = operator.attrgetter('group')
        ordered = sorted(eps, key=by_group)
        grouped = itertools.groupby(ordered, by_group)
        return cls((group, EntryPoints(eps)) for group, eps in grouped)

    @property
    def _all(self):
        """
        Reconstruct a list of all entrypoints from the groups.
        """
        return EntryPoints(itertools.chain.from_iterable(self.values()))

    @property
    def groups(self):
        return self._all.groups

    @property
    def names(self):
        """
        for coverage:
        >>> SelectableGroups().names
        set(...)
        """
        return self._all.names

    def select(self, **params):
        if not params:
            return self
        return self._all.select(**params)


def entry_points_compat(**params):
    """Return EntryPoint objects for all installed packages.

    Pass selection parameters (group or name) to filter the
    result to entry points matching those properties (see
    EntryPoints.select()).

    For compatibility, returns ``SelectableGroups`` object unless
    selection parameters are supplied. In the future, this function
    will return ``EntryPoints`` instead of ``SelectableGroups``
    even when no selection parameters are supplied.

    For maximum future compatibility, pass selection parameters
    or invoke ``.select`` with parameters on the result.

    :return: EntryPoints or SelectableGroups for all installed packages.
    """

    def dist_name(dist):
        return dist.metadata['Name']

    unique = functools.partial(unique_everseen, key=dist_name)
    eps = itertools.chain.from_iterable(
        dist.entry_points for dist in unique(distributions())
    )
    return SelectableGroups.load(eps).select(**params)


needs_backport = not hasattr(metadata, 'EntryPoints') or issubclass(
    metadata.EntryPoints, tuple
)

entry_points = entry_points_compat if needs_backport else metadata.entry_points
