"""Python Enumerations"""

import sys as _sys

__all__ = ['Enum', 'IntEnum', 'unique']

version = 1, 1, 6

pyver = float('%s.%s' % _sys.version_info[:2])

try:
    any
except NameError:
    def any(iterable):
        for element in iterable:
            if element:
                return True
        return False

try:
    from collections import OrderedDict
except ImportError:
    OrderedDict = None

try:
    basestring
except NameError:
    # In Python 2 basestring is the ancestor of both str and unicode
    # in Python 3 it's just str, but was missing in 3.1
    basestring = str

try:
    unicode
except NameError:
    # In Python 3 unicode no longer exists (it's just str)
    unicode = str

class _RouteClassAttributeToGetattr(object):
    """Route attribute access on a class to __getattr__.

    This is a descriptor, used to define attributes that act differently when
    accessed through an instance and through a class.  Instance access remains
    normal, but access to an attribute through a class will be routed to the
    class's __getattr__ method; this is done by raising AttributeError.

    """
    def __init__(self, fget=None):
        self.fget = fget

    def __get__(self, instance, ownerclass=None):
        if instance is None:
            raise AttributeError()
        return self.fget(instance)

    def __set__(self, instance, value):
        raise AttributeError("can't set attribute")

    def __delete__(self, instance):
        raise AttributeError("can't delete attribute")


def _is_descriptor(obj):
    """Returns True if obj is a descriptor, False otherwise."""
    return (
            hasattr(obj, '__get__') or
            hasattr(obj, '__set__') or
            hasattr(obj, '__delete__'))


def _is_dunder(name):
    """Returns True if a __dunder__ name, False otherwise."""
    return (name[:2] == name[-2:] == '__' and
            name[2:3] != '_' and
            name[-3:-2] != '_' and
            len(name) > 4)


def _is_sunder(name):
    """Returns True if a _sunder_ name, False otherwise."""
    return (name[0] == name[-1] == '_' and
            name[1:2] != '_' and
            name[-2:-1] != '_' and
            len(name) > 2)


def _make_class_unpicklable(cls):
    """Make the given class un-picklable."""
    def _break_on_call_reduce(self, protocol=None):
        raise TypeError('%r cannot be pickled' % self)
    cls.__reduce_ex__ = _break_on_call_reduce
    cls.__module__ = '<unknown>'


class _EnumDict(dict):
    """Track enum member order and ensure member names are not reused.

    EnumMeta will use the names found in self._member_names as the
    enumeration member names.

    """
    def __init__(self):
        super(_EnumDict, self).__init__()
        self._member_names = []

    def __setitem__(self, key, value):
        """Changes anything not dundered or not a descriptor.

        If a descriptor is added with the same name as an enum member, the name
        is removed from _member_names (this may leave a hole in the numerical
        sequence of values).

        If an enum member name is used twice, an error is raised; duplicate
        values are not checked for.

        Single underscore (sunder) names are reserved.

        Note:   in 3.x __order__ is simply discarded as a not necessary piece
                leftover from 2.x

        """
        if pyver >= 3.0 and key in ('_order_', '__order__'):
            return
        elif key == '__order__':
            key = '_order_'
        if _is_sunder(key):
            if key != '_order_':
                raise ValueError('_names_ are reserved for future Enum use')
        elif _is_dunder(key):
            pass
        elif key in self._member_names:
            # descriptor overwriting an enum?
            raise TypeError('Attempted to reuse key: %r' % key)
        elif not _is_descriptor(value):
            if key in self:
                # enum overwriting a descriptor?
                raise TypeError('Key already defined as: %r' % self[key])
            self._member_names.append(key)
        super(_EnumDict, self).__setitem__(key, value)


# Dummy value for Enum as EnumMeta explicity checks for it, but of course until
# EnumMeta finishes running the first time the Enum class doesn't exist.  This
# is also why there are checks in EnumMeta like `if Enum is not None`
Enum = None


class EnumMeta(type):
    """Metaclass for Enum"""
    @classmethod
    def __prepare__(metacls, cls, bases):
        return _EnumDict()

    def __new__(metacls, cls, bases, classdict):
        # an Enum class is final once enumeration items have been defined; it
        # cannot be mixed with other types (int, float, etc.) if it has an
        # inherited __new__ unless a new __new__ is defined (or the resulting
        # class will fail).
        if type(classdict) is dict:
            original_dict = classdict
            classdict = _EnumDict()
            for k, v in original_dict.items():
                classdict[k] = v

        member_type, first_enum = metacls._get_mixins_(bases)
        __new__, save_new, use_args = metacls._find_new_(classdict, member_type,
                                                        first_enum)
        # save enum items into separate mapping so they don't get baked into
        # the new class
        members = dict((k, classdict[k]) for k in classdict._member_names)
        for name in classdict._member_names:
            del classdict[name]

        # py2 support for definition order
        _order_ = classdict.get('_order_')
        if _order_ is None:
            if pyver < 3.0:
                try:
                    _order_ = [name for (name, value) in sorted(members.items(), key=lambda item: item[1])]
                except TypeError:
                    _order_ = [name for name in sorted(members.keys())]
            else:
                _order_ = classdict._member_names
        else:
            del classdict['_order_']
            if pyver < 3.0:
                _order_ = _order_.replace(',', ' ').split()
                aliases = [name for name in members if name not in _order_]
                _order_ += aliases

        # check for illegal enum names (any others?)
        invalid_names = set(members) & set(['mro'])
        if invalid_names:
            raise ValueError('Invalid enum member name(s): %s' % (
                ', '.join(invalid_names), ))

        # save attributes from super classes so we know if we can take
        # the shortcut of storing members in the class dict
        base_attributes = set([a for b in bases for a in b.__dict__])
        # create our new Enum type
        enum_class = super(EnumMeta, metacls).__new__(metacls, cls, bases, classdict)
        enum_class._member_names_ = []               # names in random order
        if OrderedDict is not None:
            enum_class._member_map_ = OrderedDict()
        else:
            enum_class._member_map_ = {}             # name->value map
        enum_class._member_type_ = member_type

        # Reverse value->name map for hashable values.
        enum_class._value2member_map_ = {}

        # instantiate them, checking for duplicates as we go
        # we instantiate first instead of checking for duplicates first in case
        # a custom __new__ is doing something funky with the values -- such as
        # auto-numbering ;)
        if __new__ is None:
            __new__ = enum_class.__new__
        for member_name in _order_:
            value = members[member_name]
            if not isinstance(value, tuple):
                args = (value, )
            else:
                args = value
            if member_type is tuple:   # special case for tuple enums
                args = (args, )     # wrap it one more time
            if not use_args or not args:
                enum_member = __new__(enum_class)
                if not hasattr(enum_member, '_value_'):
                    enum_member._value_ = value
            else:
                enum_member = __new__(enum_class, *args)
                if not hasattr(enum_member, '_value_'):
                    enum_member._value_ = member_type(*args)
            value = enum_member._value_
            enum_member._name_ = member_name
            enum_member.__objclass__ = enum_class
            enum_member.__init__(*args)
            # If another member with the same value was already defined, the
            # new member becomes an alias to the existing one.
            for name, canonical_member in enum_class._member_map_.items():
                if canonical_member.value == enum_member._value_:
                    enum_member = canonical_member
                    break
            else:
                # Aliases don't appear in member names (only in __members__).
                enum_class._member_names_.append(member_name)
            # performance boost for any member that would not shadow
            # a DynamicClassAttribute (aka _RouteClassAttributeToGetattr)
            if member_name not in base_attributes:
                setattr(enum_class, member_name, enum_member)
            # now add to _member_map_
            enum_class._member_map_[member_name] = enum_member
            try:
                # This may fail if value is not hashable. We can't add the value
                # to the map, and by-value lookups for this value will be
                # linear.
                enum_class._value2member_map_[value] = enum_member
            except TypeError:
                pass


        # If a custom type is mixed into the Enum, and it does not know how
        # to pickle itself, pickle.dumps will succeed but pickle.loads will
        # fail.  Rather than have the error show up later and possibly far
        # from the source, sabotage the pickle protocol for this class so
        # that pickle.dumps also fails.
        #
        # However, if the new class implements its own __reduce_ex__, do not
        # sabotage -- it's on them to make sure it works correctly.  We use
        # __reduce_ex__ instead of any of the others as it is preferred by
        # pickle over __reduce__, and it handles all pickle protocols.
        unpicklable = False
        if '__reduce_ex__' not in classdict:
            if member_type is not object:
                methods = ('__getnewargs_ex__', '__getnewargs__',
                        '__reduce_ex__', '__reduce__')
                if not any(m in member_type.__dict__ for m in methods):
                    _make_class_unpicklable(enum_class)
                    unpicklable = True


        # double check that repr and friends are not the mixin's or various
        # things break (such as pickle)
        for name in ('__repr__', '__str__', '__format__', '__reduce_ex__'):
            class_method = getattr(enum_class, name)
            obj_method = getattr(member_type, name, None)
            enum_method = getattr(first_enum, name, None)
            if name not in classdict and class_method is not enum_method:
                if name == '__reduce_ex__' and unpicklable:
                    continue
                setattr(enum_class, name, enum_method)

        # method resolution and int's are not playing nice
        # Python's less than 2.6 use __cmp__

        if pyver < 2.6:

            if issubclass(enum_class, int):
                setattr(enum_class, '__cmp__', getattr(int, '__cmp__'))

        elif pyver < 3.0:

            if issubclass(enum_class, int):
                for method in (
                        '__le__',
                        '__lt__',
                        '__gt__',
                        '__ge__',
                        '__eq__',
                        '__ne__',
                        '__hash__',
                        ):
                    setattr(enum_class, method, getattr(int, method))

        # replace any other __new__ with our own (as long as Enum is not None,
        # anyway) -- again, this is to support pickle
        if Enum is not None:
            # if the user defined their own __new__, save it before it gets
            # clobbered in case they subclass later
            if save_new:
                setattr(enum_class, '__member_new__', enum_class.__dict__['__new__'])
            setattr(enum_class, '__new__', Enum.__dict__['__new__'])
        return enum_class

    def __bool__(cls):
        """
        classes/types should always be True.
        """
        return True

    def __call__(cls, value, names=None, module=None, type=None, start=1):
        """Either returns an existing member, or creates a new enum class.

        This method is used both when an enum class is given a value to match
        to an enumeration member (i.e. Color(3)) and for the functional API
        (i.e. Color = Enum('Color', names='red green blue')).

        When used for the functional API: `module`, if set, will be stored in
        the new class' __module__ attribute; `type`, if set, will be mixed in
        as the first base class.

        Note: if `module` is not set this routine will attempt to discover the
        calling module by walking the frame stack; if this is unsuccessful
        the resulting class will not be pickleable.

        """
        if names is None:  # simple value lookup
            return cls.__new__(cls, value)
        # otherwise, functional API: we're creating a new Enum type
        return cls._create_(value, names, module=module, type=type, start=start)

    def __contains__(cls, member):
        return isinstance(member, cls) and member.name in cls._member_map_

    def __delattr__(cls, attr):
        # nicer error message when someone tries to delete an attribute
        # (see issue19025).
        if attr in cls._member_map_:
            raise AttributeError(
                    "%s: cannot delete Enum member." % cls.__name__)
        super(EnumMeta, cls).__delattr__(attr)

    def __dir__(self):
        return (['__class__', '__doc__', '__members__', '__module__'] +
                self._member_names_)

    @property
    def __members__(cls):
        """Returns a mapping of member name->value.

        This mapping lists all enum members, including aliases. Note that this
        is a copy of the internal mapping.

        """
        return cls._member_map_.copy()

    def __getattr__(cls, name):
        """Return the enum member matching `name`

        We use __getattr__ instead of descriptors or inserting into the enum
        class' __dict__ in order to support `name` and `value` being both
        properties for enum members (which live in the class' __dict__) and
        enum members themselves.

        """
        if _is_dunder(name):
            raise AttributeError(name)
        try:
            return cls._member_map_[name]
        except KeyError:
            raise AttributeError(name)

    def __getitem__(cls, name):
        return cls._member_map_[name]

    def __iter__(cls):
        return (cls._member_map_[name] for name in cls._member_names_)

    def __reversed__(cls):
        return (cls._member_map_[name] for name in reversed(cls._member_names_))

    def __len__(cls):
        return len(cls._member_names_)

    __nonzero__ = __bool__

    def __repr__(cls):
        return "<enum %r>" % cls.__name__

    def __setattr__(cls, name, value):
        """Block attempts to reassign Enum members.

        A simple assignment to the class namespace only changes one of the
        several possible ways to get an Enum member from the Enum class,
        resulting in an inconsistent Enumeration.

        """
        member_map = cls.__dict__.get('_member_map_', {})
        if name in member_map:
            raise AttributeError('Cannot reassign members.')
        super(EnumMeta, cls).__setattr__(name, value)

    def _create_(cls, class_name, names=None, module=None, type=None, start=1):
        """Convenience method to create a new Enum class.

        `names` can be:

        * A string containing member names, separated either with spaces or
          commas.  Values are auto-numbered from 1.
        * An iterable of member names.  Values are auto-numbered from 1.
        * An iterable of (member name, value) pairs.
        * A mapping of member name -> value.

        """
        if pyver < 3.0:
            # if class_name is unicode, attempt a conversion to ASCII
            if isinstance(class_name, unicode):
                try:
                    class_name = class_name.encode('ascii')
                except UnicodeEncodeError:
                    raise TypeError('%r is not representable in ASCII' % class_name)
        metacls = cls.__class__
        if type is None:
            bases = (cls, )
        else:
            bases = (type, cls)
        classdict = metacls.__prepare__(class_name, bases)
        _order_ = []

        # special processing needed for names?
        if isinstance(names, basestring):
            names = names.replace(',', ' ').split()
        if isinstance(names, (tuple, list)) and isinstance(names[0], basestring):
            names = [(e, i+start) for (i, e) in enumerate(names)]

        # Here, names is either an iterable of (name, value) or a mapping.
        item = None  # in case names is empty
        for item in names:
            if isinstance(item, basestring):
                member_name, member_value = item, names[item]
            else:
                member_name, member_value = item
            classdict[member_name] = member_value
            _order_.append(member_name)
        # only set _order_ in classdict if name/value was not from a mapping
        if not isinstance(item, basestring):
            classdict['_order_'] = ' '.join(_order_)
        enum_class = metacls.__new__(metacls, class_name, bases, classdict)

        # TODO: replace the frame hack if a blessed way to know the calling
        # module is ever developed
        if module is None:
            try:
                module = _sys._getframe(2).f_globals['__name__']
            except (AttributeError, ValueError):
                pass
        if module is None:
            _make_class_unpicklable(enum_class)
        else:
            enum_class.__module__ = module

        return enum_class

    @staticmethod
    def _get_mixins_(bases):
        """Returns the type for creating enum members, and the first inherited
        enum class.

        bases: the tuple of bases that was given to __new__

        """
        if not bases or Enum is None:
            return object, Enum


        # double check that we are not subclassing a class with existing
        # enumeration members; while we're at it, see if any other data
        # type has been mixed in so we can use the correct __new__
        member_type = first_enum = None
        for base in bases:
            if  (base is not Enum and
                    issubclass(base, Enum) and
                    base._member_names_):
                raise TypeError("Cannot extend enumerations")
        # base is now the last base in bases
        if not issubclass(base, Enum):
            raise TypeError("new enumerations must be created as "
                    "`ClassName([mixin_type,] enum_type)`")

        # get correct mix-in type (either mix-in type of Enum subclass, or
        # first base if last base is Enum)
        if not issubclass(bases[0], Enum):
            member_type = bases[0]     # first data type
            first_enum = bases[-1]  # enum type
        else:
            for base in bases[0].__mro__:
                # most common: (IntEnum, int, Enum, object)
                # possible:    (<Enum 'AutoIntEnum'>, <Enum 'IntEnum'>,
                #               <class 'int'>, <Enum 'Enum'>,
                #               <class 'object'>)
                if issubclass(base, Enum):
                    if first_enum is None:
                        first_enum = base
                else:
                    if member_type is None:
                        member_type = base

        return member_type, first_enum

    if pyver < 3.0:
        @staticmethod
        def _find_new_(classdict, member_type, first_enum):
            """Returns the __new__ to be used for creating the enum members.

            classdict: the class dictionary given to __new__
            member_type: the data type whose __new__ will be used by default
            first_enum: enumeration to check for an overriding __new__

            """
            # now find the correct __new__, checking to see of one was defined
            # by the user; also check earlier enum classes in case a __new__ was
            # saved as __member_new__
            __new__ = classdict.get('__new__', None)
            if __new__:
                return None, True, True      # __new__, save_new, use_args

            N__new__ = getattr(None, '__new__')
            O__new__ = getattr(object, '__new__')
            if Enum is None:
                E__new__ = N__new__
            else:
                E__new__ = Enum.__dict__['__new__']
            # check all possibles for __member_new__ before falling back to
            # __new__
            for method in ('__member_new__', '__new__'):
                for possible in (member_type, first_enum):
                    try:
                        target = possible.__dict__[method]
                    except (AttributeError, KeyError):
                        target = getattr(possible, method, None)
                    if target not in [
                            None,
                            N__new__,
                            O__new__,
                            E__new__,
                            ]:
                        if method == '__member_new__':
                            classdict['__new__'] = target
                            return None, False, True
                        if isinstance(target, staticmethod):
                            target = target.__get__(member_type)
                        __new__ = target
                        break
                if __new__ is not None:
                    break
            else:
                __new__ = object.__new__

            # if a non-object.__new__ is used then whatever value/tuple was
            # assigned to the enum member name will be passed to __new__ and to the
            # new enum member's __init__
            if __new__ is object.__new__:
                use_args = False
            else:
                use_args = True

            return __new__, False, use_args
    else:
        @staticmethod
        def _find_new_(classdict, member_type, first_enum):
            """Returns the __new__ to be used for creating the enum members.

            classdict: the class dictionary given to __new__
            member_type: the data type whose __new__ will be used by default
            first_enum: enumeration to check for an overriding __new__

            """
            # now find the correct __new__, checking to see of one was defined
            # by the user; also check earlier enum classes in case a __new__ was
            # saved as __member_new__
            __new__ = classdict.get('__new__', None)

            # should __new__ be saved as __member_new__ later?
            save_new = __new__ is not None

            if __new__ is None:
                # check all possibles for __member_new__ before falling back to
                # __new__
                for method in ('__member_new__', '__new__'):
                    for possible in (member_type, first_enum):
                        target = getattr(possible, method, None)
                        if target not in (
                                None,
                                None.__new__,
                                object.__new__,
                                Enum.__new__,
                                ):
                            __new__ = target
                            break
                    if __new__ is not None:
                        break
                else:
                    __new__ = object.__new__

            # if a non-object.__new__ is used then whatever value/tuple was
            # assigned to the enum member name will be passed to __new__ and to the
            # new enum member's __init__
            if __new__ is object.__new__:
                use_args = False
            else:
                use_args = True

            return __new__, save_new, use_args


########################################################
# In order to support Python 2 and 3 with a single
# codebase we have to create the Enum methods separately
# and then use the `type(name, bases, dict)` method to
# create the class.
########################################################
temp_enum_dict = {}
temp_enum_dict['__doc__'] = "Generic enumeration.\n\n    Derive from this class to define new enumerations.\n\n"

def __new__(cls, value):
    # all enum instances are actually created during class construction
    # without calling this method; this method is called by the metaclass'
    # __call__ (i.e. Color(3) ), and by pickle
    if type(value) is cls:
        # For lookups like Color(Color.red)
        value = value.value
        #return value
    # by-value search for a matching enum member
    # see if it's in the reverse mapping (for hashable values)
    try:
        if value in cls._value2member_map_:
            return cls._value2member_map_[value]
    except TypeError:
        # not there, now do long search -- O(n) behavior
        for member in cls._member_map_.values():
            if member.value == value:
                return member
    raise ValueError("%s is not a valid %s" % (value, cls.__name__))
temp_enum_dict['__new__'] = __new__
del __new__

def __repr__(self):
    return "<%s.%s: %r>" % (
            self.__class__.__name__, self._name_, self._value_)
temp_enum_dict['__repr__'] = __repr__
del __repr__

def __str__(self):
    return "%s.%s" % (self.__class__.__name__, self._name_)
temp_enum_dict['__str__'] = __str__
del __str__

if pyver >= 3.0:
    def __dir__(self):
        added_behavior = [
                m
                for cls in self.__class__.mro()
                for m in cls.__dict__
                if m[0] != '_' and m not in self._member_map_
                ]
        return (['__class__', '__doc__', '__module__', ] + added_behavior)
    temp_enum_dict['__dir__'] = __dir__
    del __dir__

def __format__(self, format_spec):
    # mixed-in Enums should use the mixed-in type's __format__, otherwise
    # we can get strange results with the Enum name showing up instead of
    # the value

    # pure Enum branch
    if self._member_type_ is object:
        cls = str
        val = str(self)
    # mix-in branch
    else:
        cls = self._member_type_
        val = self.value
    return cls.__format__(val, format_spec)
temp_enum_dict['__format__'] = __format__
del __format__


####################################
# Python's less than 2.6 use __cmp__

if pyver < 2.6:

    def __cmp__(self, other):
        if type(other) is self.__class__:
            if self is other:
                return 0
            return -1
        return NotImplemented
        raise TypeError("unorderable types: %s() and %s()" % (self.__class__.__name__, other.__class__.__name__))
    temp_enum_dict['__cmp__'] = __cmp__
    del __cmp__

else:

    def __le__(self, other):
        raise TypeError("unorderable types: %s() <= %s()" % (self.__class__.__name__, other.__class__.__name__))
    temp_enum_dict['__le__'] = __le__
    del __le__

    def __lt__(self, other):
        raise TypeError("unorderable types: %s() < %s()" % (self.__class__.__name__, other.__class__.__name__))
    temp_enum_dict['__lt__'] = __lt__
    del __lt__

    def __ge__(self, other):
        raise TypeError("unorderable types: %s() >= %s()" % (self.__class__.__name__, other.__class__.__name__))
    temp_enum_dict['__ge__'] = __ge__
    del __ge__

    def __gt__(self, other):
        raise TypeError("unorderable types: %s() > %s()" % (self.__class__.__name__, other.__class__.__name__))
    temp_enum_dict['__gt__'] = __gt__
    del __gt__


def __eq__(self, other):
    if type(other) is self.__class__:
        return self is other
    return NotImplemented
temp_enum_dict['__eq__'] = __eq__
del __eq__

def __ne__(self, other):
    if type(other) is self.__class__:
        return self is not other
    return NotImplemented
temp_enum_dict['__ne__'] = __ne__
del __ne__

def __hash__(self):
    return hash(self._name_)
temp_enum_dict['__hash__'] = __hash__
del __hash__

def __reduce_ex__(self, proto):
    return self.__class__, (self._value_, )
temp_enum_dict['__reduce_ex__'] = __reduce_ex__
del __reduce_ex__

# _RouteClassAttributeToGetattr is used to provide access to the `name`
# and `value` properties of enum members while keeping some measure of
# protection from modification, while still allowing for an enumeration
# to have members named `name` and `value`.  This works because enumeration
# members are not set directly on the enum class -- __getattr__ is
# used to look them up.

@_RouteClassAttributeToGetattr
def name(self):
    return self._name_
temp_enum_dict['name'] = name
del name

@_RouteClassAttributeToGetattr
def value(self):
    return self._value_
temp_enum_dict['value'] = value
del value

@classmethod
def _convert(cls, name, module, filter, source=None):
    """
    Create a new Enum subclass that replaces a collection of global constants
    """
    # convert all constants from source (or module) that pass filter() to
    # a new Enum called name, and export the enum and its members back to
    # module;
    # also, replace the __reduce_ex__ method so unpickling works in
    # previous Python versions
    module_globals = vars(_sys.modules[module])
    if source:
        source = vars(source)
    else:
        source = module_globals
    members = dict((name, value) for name, value in source.items() if filter(name))
    cls = cls(name, members, module=module)
    cls.__reduce_ex__ = _reduce_ex_by_name
    module_globals.update(cls.__members__)
    module_globals[name] = cls
    return cls
temp_enum_dict['_convert'] = _convert
del _convert

Enum = EnumMeta('Enum', (object, ), temp_enum_dict)
del temp_enum_dict

# Enum has now been created
###########################

class IntEnum(int, Enum):
    """Enum where members are also (and must be) ints"""

def _reduce_ex_by_name(self, proto):
    return self.name

def unique(enumeration):
    """Class decorator that ensures only unique members exist in an enumeration."""
    duplicates = []
    for name, member in enumeration.__members__.items():
        if name != member.name:
            duplicates.append((name, member.name))
    if duplicates:
        duplicate_names = ', '.join(
                ["%s -> %s" % (alias, name) for (alias, name) in duplicates]
                )
        raise ValueError('duplicate names found in %r: %s' %
                (enumeration, duplicate_names)
                )
    return enumeration
