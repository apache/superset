import sqlalchemy as sa
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.util.langhelpers import symbol

from .utils import str_coercible


@str_coercible
class Path(object):
    def __init__(self, path, separator='.'):
        if isinstance(path, Path):
            self.path = path.path
        else:
            self.path = path
        self.separator = separator

    @property
    def parts(self):
        return self.path.split(self.separator)

    def __iter__(self):
        for part in self.parts:
            yield part

    def __len__(self):
        return len(self.parts)

    def __repr__(self):
        return "%s('%s')" % (self.__class__.__name__, self.path)

    def index(self, element):
        return self.parts.index(element)

    def __getitem__(self, slice):
        result = self.parts[slice]
        if isinstance(result, list):
            return self.__class__(
                self.separator.join(result),
                separator=self.separator
            )
        return result

    def __eq__(self, other):
        return self.path == other.path and self.separator == other.separator

    def __ne__(self, other):
        return not (self == other)

    def __unicode__(self):
        return self.path


def get_attr(mixed, attr):
    if isinstance(mixed, InstrumentedAttribute):
        return getattr(
            mixed.property.mapper.class_,
            attr
        )
    else:
        return getattr(mixed, attr)


@str_coercible
class AttrPath(object):
    def __init__(self, class_, path):
        self.class_ = class_
        self.path = Path(path)
        self.parts = []
        last_attr = class_
        for value in self.path:
            last_attr = get_attr(last_attr, value)
            self.parts.append(last_attr)

    def __iter__(self):
        for part in self.parts:
            yield part

    def __invert__(self):
        def get_backref(part):
            prop = part.property
            backref = prop.backref or prop.back_populates
            if backref is None:
                raise Exception(
                    "Invert failed because property '%s' of class "
                    "%s has no backref." % (
                        prop.key,
                        prop.parent.class_.__name__
                    )
                )
            if isinstance(backref, tuple):
                return backref[0]
            else:
                return backref

        if isinstance(self.parts[-1].property, sa.orm.ColumnProperty):
            class_ = self.parts[-1].class_
        else:
            class_ = self.parts[-1].mapper.class_

        return self.__class__(
            class_,
            '.'.join(map(get_backref, reversed(self.parts)))
        )

    def index(self, element):
        for index, el in enumerate(self.parts):
            if el is element:
                return index

    @property
    def direction(self):
        symbols = [part.property.direction for part in self.parts]
        if symbol('MANYTOMANY') in symbols:
            return symbol('MANYTOMANY')
        elif symbol('MANYTOONE') in symbols and symbol('ONETOMANY') in symbols:
            return symbol('MANYTOMANY')
        return symbols[0]

    @property
    def uselist(self):
        return any(part.property.uselist for part in self.parts)

    def __getitem__(self, slice):
        result = self.parts[slice]
        if isinstance(result, list) and result:
            if result[0] is self.parts[0]:
                class_ = self.class_
            else:
                class_ = result[0].parent.class_
            return self.__class__(
                class_,
                self.path[slice]
            )
        else:
            return result

    def __len__(self):
        return len(self.path)

    def __repr__(self):
        return "%s(%s, %r)" % (
            self.__class__.__name__,
            self.class_.__name__,
            self.path.path
        )

    def __eq__(self, other):
        return self.path == other.path and self.class_ == other.class_

    def __ne__(self, other):
        return not (self == other)

    def __unicode__(self):
        return str(self.path)
