import six
from sqlalchemy import types

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible

ip_address = None
try:
    from ipaddress import ip_address
except ImportError:
    try:
        from ipaddr import IPAddress as ip_address
    except ImportError:
        pass


class IPAddressType(types.TypeDecorator, ScalarCoercible):
    """
    Changes IPAddress objects to a string representation on the way in and
    changes them back to IPAddress objects on the way out.

    IPAddressType uses ipaddress package on Python >= 3 and ipaddr_ package on
    Python 2. In order to use IPAddressType with python you need to install
    ipaddr_ first.

    .. _ipaddr: https://pypi.python.org/pypi/ipaddr

    ::


        from sqlalchemy_utils import IPAddressType


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, autoincrement=True)
            name = sa.Column(sa.Unicode(255))
            ip_address = sa.Column(IPAddressType)


        user = User()
        user.ip_address = '123.123.123.123'
        session.add(user)
        session.commit()

        user.ip_address  # IPAddress object
    """

    impl = types.Unicode(50)

    def __init__(self, max_length=50, *args, **kwargs):
        if not ip_address:
            raise ImproperlyConfigured(
                "'ipaddr' package is required to use 'IPAddressType' "
                "in python 2"
            )

        super(IPAddressType, self).__init__(*args, **kwargs)
        self.impl = types.Unicode(max_length)

    def process_bind_param(self, value, dialect):
        return six.text_type(value) if value else None

    def process_result_value(self, value, dialect):
        return ip_address(value) if value else None

    def _coerce(self, value):
        return ip_address(value) if value else None

    @property
    def python_type(self):
        return self.impl.type.python_type
