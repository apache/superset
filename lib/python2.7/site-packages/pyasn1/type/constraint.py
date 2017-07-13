#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
# Original concept and code by Mike C. Fletcher.
#
import sys
from pyasn1.type import error

__all__ = ['SingleValueConstraint', 'ContainedSubtypeConstraint', 'ValueRangeConstraint',
           'ValueSizeConstraint', 'PermittedAlphabetConstraint', 'InnerTypeConstraint',
           'ConstraintsExclusion', 'ConstraintsIntersection', 'ConstraintsUnion']


class AbstractConstraint(object):
    """Abstract base-class for constraint objects

       Constraints should be stored in a simple sequence in the
       namespace of their client Asn1Item sub-classes in cases
       when ASN.1 constraint is define.
    """

    def __init__(self, *values):
        self._valueMap = {}
        self._setValues(values)
        self.__hashedValues = None

    def __call__(self, value, idx=None):
        try:
            self._testValue(value, idx)
        except error.ValueConstraintError:
            raise error.ValueConstraintError(
                '%s failed at: %r' % (self, sys.exc_info()[1])
            )

    def __repr__(self):
        return '%s(%s)' % (
            self.__class__.__name__,
            ', '.join([repr(x) for x in self._values])
        )

    def __eq__(self, other):
        return self is other and True or self._values == other

    def __ne__(self, other):
        return self._values != other

    def __lt__(self, other):
        return self._values < other

    def __le__(self, other):
        return self._values <= other

    def __gt__(self, other):
        return self._values > other

    def __ge__(self, other):
        return self._values >= other

    if sys.version_info[0] <= 2:
        def __nonzero__(self):
            return bool(self._values)
    else:
        def __bool__(self):
            return bool(self._values)

    def __hash__(self):
        if self.__hashedValues is None:
            self.__hashedValues = hash((self.__class__.__name__, self._values))
        return self.__hashedValues

    def _setValues(self, values):
        self._values = values

    def _testValue(self, value, idx):
        raise error.ValueConstraintError(value)

    # Constraints derivation logic
    def getValueMap(self):
        return self._valueMap

    def isSuperTypeOf(self, otherConstraint):
        return self in otherConstraint.getValueMap() or \
               otherConstraint is self or otherConstraint == self

    def isSubTypeOf(self, otherConstraint):
        return otherConstraint in self._valueMap or \
               otherConstraint is self or otherConstraint == self


class SingleValueConstraint(AbstractConstraint):
    """Value must be part of defined values constraint"""

    def _testValue(self, value, idx):
        # XXX index vals for performance?
        if value not in self._values:
            raise error.ValueConstraintError(value)


class ContainedSubtypeConstraint(AbstractConstraint):
    """Value must satisfy all of defined set of constraints"""

    def _testValue(self, value, idx):
        for c in self._values:
            c(value, idx)


class ValueRangeConstraint(AbstractConstraint):
    """Value must be within start and stop values (inclusive)"""

    def _testValue(self, value, idx):
        if value < self.start or value > self.stop:
            raise error.ValueConstraintError(value)

    def _setValues(self, values):
        if len(values) != 2:
            raise error.PyAsn1Error(
                '%s: bad constraint values' % (self.__class__.__name__,)
            )
        self.start, self.stop = values
        if self.start > self.stop:
            raise error.PyAsn1Error(
                '%s: screwed constraint values (start > stop): %s > %s' % (
                    self.__class__.__name__,
                    self.start, self.stop
                )
            )
        AbstractConstraint._setValues(self, values)


class ValueSizeConstraint(ValueRangeConstraint):
    """len(value) must be within start and stop values (inclusive)"""

    def _testValue(self, value, idx):
        l = len(value)
        if l < self.start or l > self.stop:
            raise error.ValueConstraintError(value)


class PermittedAlphabetConstraint(SingleValueConstraint):
    def _setValues(self, values):
        self._values = ()
        for v in values:
            self._values = self._values + tuple(v)

    def _testValue(self, value, idx):
        for v in value:
            if v not in self._values:
                raise error.ValueConstraintError(value)


# This is a bit kludgy, meaning two op modes within a single constraint
class InnerTypeConstraint(AbstractConstraint):
    """Value must satisfy type and presense constraints"""

    def _testValue(self, value, idx):
        if self.__singleTypeConstraint:
            self.__singleTypeConstraint(value)
        elif self.__multipleTypeConstraint:
            if idx not in self.__multipleTypeConstraint:
                raise error.ValueConstraintError(value)
            constraint, status = self.__multipleTypeConstraint[idx]
            if status == 'ABSENT':  # XXX presense is not checked!
                raise error.ValueConstraintError(value)
            constraint(value)

    def _setValues(self, values):
        self.__multipleTypeConstraint = {}
        self.__singleTypeConstraint = None
        for v in values:
            if isinstance(v, tuple):
                self.__multipleTypeConstraint[v[0]] = v[1], v[2]
            else:
                self.__singleTypeConstraint = v
        AbstractConstraint._setValues(self, values)


# Boolean ops on constraints

class ConstraintsExclusion(AbstractConstraint):
    """Value must not fit the single constraint"""

    def _testValue(self, value, idx):
        try:
            self._values[0](value, idx)
        except error.ValueConstraintError:
            return
        else:
            raise error.ValueConstraintError(value)

    def _setValues(self, values):
        if len(values) != 1:
            raise error.PyAsn1Error('Single constraint expected')
        AbstractConstraint._setValues(self, values)


class AbstractConstraintSet(AbstractConstraint):
    """Value must not satisfy the single constraint"""

    def __getitem__(self, idx): return self._values[idx]

    def __add__(self, value): return self.__class__(self, value)

    def __radd__(self, value): return self.__class__(value, self)

    def __len__(self): return len(self._values)

    # Constraints inclusion in sets

    def _setValues(self, values):
        self._values = values
        for v in values:
            self._valueMap[v] = 1
            self._valueMap.update(v.getValueMap())


class ConstraintsIntersection(AbstractConstraintSet):
    """Value must satisfy all constraints"""

    def _testValue(self, value, idx):
        for v in self._values:
            v(value, idx)


class ConstraintsUnion(AbstractConstraintSet):
    """Value must satisfy at least one constraint"""

    def _testValue(self, value, idx):
        for v in self._values:
            try:
                v(value, idx)
            except error.ValueConstraintError:
                pass
            else:
                return
        raise error.ValueConstraintError(
            'all of %s failed for \"%s\"' % (self._values, value)
        )

# XXX
# add tests for type check
