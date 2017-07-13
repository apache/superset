# -*- coding: utf-8 -*-
import base64
import datetime

import six
from sqlalchemy.types import LargeBinary, String, TypeDecorator

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible

cryptography = None
try:
    import cryptography
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers import (
        Cipher, algorithms, modes
    )
    from cryptography.fernet import Fernet
except ImportError:
    pass


class EncryptionDecryptionBaseEngine(object):
    """A base encryption and decryption engine.

    This class must be sub-classed in order to create
    new engines.
    """

    def _update_key(self, key):
        if isinstance(key, six.string_types):
            key = key.encode()
        digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
        digest.update(key)
        engine_key = digest.finalize()

        self._initialize_engine(engine_key)

    def encrypt(self, value):
        raise NotImplementedError('Subclasses must implement this!')

    def decrypt(self, value):
        raise NotImplementedError('Subclasses must implement this!')


class AesEngine(EncryptionDecryptionBaseEngine):
    """Provide AES encryption and decryption methods."""

    BLOCK_SIZE = 16
    PADDING = six.b('*')

    def _initialize_engine(self, parent_class_key):
        self.secret_key = parent_class_key
        self.iv = self.secret_key[:16]
        self.cipher = Cipher(
            algorithms.AES(self.secret_key),
            modes.CBC(self.iv),
            backend=default_backend()
        )

    def _pad(self, value):
        """Pad the message to be encrypted, if needed."""
        BS = self.BLOCK_SIZE
        P = self.PADDING
        padded = (value + (BS - len(value) % BS) * P)
        return padded

    def encrypt(self, value):
        if not isinstance(value, six.string_types):
            value = repr(value)
        if isinstance(value, six.text_type):
            value = str(value)
        value = value.encode()
        value = self._pad(value)
        encryptor = self.cipher.encryptor()
        encrypted = encryptor.update(value) + encryptor.finalize()
        encrypted = base64.b64encode(encrypted)
        return encrypted

    def decrypt(self, value):
        if isinstance(value, six.text_type):
            value = str(value)
        decryptor = self.cipher.decryptor()
        decrypted = base64.b64decode(value)
        decrypted = decryptor.update(decrypted) + decryptor.finalize()
        decrypted = decrypted.rstrip(self.PADDING)
        if not isinstance(decrypted, six.string_types):
            decrypted = decrypted.decode('utf-8')
        return decrypted


class FernetEngine(EncryptionDecryptionBaseEngine):
    """Provide Fernet encryption and decryption methods."""

    def _initialize_engine(self, parent_class_key):
        self.secret_key = base64.urlsafe_b64encode(parent_class_key)
        self.fernet = Fernet(self.secret_key)

    def encrypt(self, value):
        if not isinstance(value, six.string_types):
            value = repr(value)
        if isinstance(value, six.text_type):
            value = str(value)
        value = value.encode()
        encrypted = self.fernet.encrypt(value)
        return encrypted

    def decrypt(self, value):
        if isinstance(value, six.text_type):
            value = str(value)
        decrypted = self.fernet.decrypt(value)
        if not isinstance(decrypted, six.string_types):
            decrypted = decrypted.decode('utf-8')
        return decrypted


class EncryptedType(TypeDecorator, ScalarCoercible):
    """
    EncryptedType provides a way to encrypt and decrypt values,
    to and from databases, that their type is a basic SQLAlchemy type.
    For example Unicode, String or even Boolean.
    On the way in, the value is encrypted and on the way out the stored value
    is decrypted.

    EncryptedType needs Cryptography_ library in order to work.
    A simple example is given below.

    .. _Cryptography: https://cryptography.io/en/latest/

    ::

        import sqlalchemy as sa
        from sqlalchemy.ext.declarative import declarative_base
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy_utils import EncryptedType


        secret_key = 'secretkey1234'
        # setup
        engine = create_engine('sqlite:///:memory:')
        connection = engine.connect()
        Base = declarative_base()

        class User(Base):
            __tablename__ = "user"
            id = sa.Column(sa.Integer, primary_key=True)
            username = sa.Column(EncryptedType(sa.Unicode, secret_key))
            access_token = sa.Column(EncryptedType(sa.String, secret_key))
            is_active = sa.Column(EncryptedType(sa.Boolean, secret_key))
            number_of_accounts = sa.Column(EncryptedType(sa.Integer,
                                                         secret_key))

        sa.orm.configure_mappers()
        Base.metadata.create_all(connection)

        # create a configured "Session" class
        Session = sessionmaker(bind=connection)

        # create a Session
        session = Session()

        # example
        user_name = u'secret_user'
        test_token = 'atesttoken'
        active = True
        num_of_accounts = 2

        user = User(username=user_name, access_token=test_token,
                    is_active=active, accounts_num=accounts)
        session.add(user)
        session.commit()

        print('id: {}'.format(user.id))
        print('username: {}'.format(user.username))
        print('token: {}'.format(user.access_token))
        print('active: {}'.format(user.is_active))
        print('accounts: {}'.format(user.accounts_num))

        # teardown
        session.close_all()
        Base.metadata.drop_all(connection)
        connection.close()
        engine.dispose()

    The key parameter accepts a callable to allow for the key to change
    per-row instead of be fixed for the whole table.

    ::
        def get_key():
            return 'dynamic-key'

        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            username = sa.Column(EncryptedType(
                sa.Unicode, get_key))

    """

    impl = LargeBinary

    def __init__(self, type_in=None, key=None, engine=None, **kwargs):
        """Initialization."""
        if not cryptography:
            raise ImproperlyConfigured(
                "'cryptography' is required to use EncryptedType"
            )
        super(EncryptedType, self).__init__(**kwargs)
        # set the underlying type
        if type_in is None:
            type_in = String()
        elif isinstance(type_in, type):
            type_in = type_in()
        self.underlying_type = type_in
        self._key = key
        if not engine:
            engine = AesEngine
        self.engine = engine()

    @property
    def key(self):
        return self._key

    @key.setter
    def key(self, value):
        self._key = value

    def _update_key(self):
        key = self._key() if callable(self._key) else self._key
        self.engine._update_key(key)

    def process_bind_param(self, value, dialect):
        """Encrypt a value on the way in."""
        if value is not None:
            self._update_key()

            try:
                value = self.underlying_type.process_bind_param(
                    value, dialect
                )

            except AttributeError:
                # Doesn't have 'process_bind_param'

                # Handle 'boolean' and 'dates'
                type_ = self.underlying_type.python_type
                if issubclass(type_, bool):
                    value = 'true' if value else 'false'

                elif issubclass(type_, (datetime.date, datetime.time)):
                    value = value.isoformat()

            return self.engine.encrypt(value)

    def process_result_value(self, value, dialect):
        """Decrypt value on the way out."""
        if value is not None:
            self._update_key()
            decrypted_value = self.engine.decrypt(value)

            try:
                return self.underlying_type.process_result_value(
                    decrypted_value, dialect
                )

            except AttributeError:
                # Doesn't have 'process_result_value'

                # Handle 'boolean' and 'dates'
                type_ = self.underlying_type.python_type
                if issubclass(type_, bool):
                    return decrypted_value == 'true'

                elif issubclass(type_, datetime.datetime):
                    return datetime.datetime.strptime(
                        decrypted_value, '%Y-%m-%dT%H:%M:%S'
                    )

                elif issubclass(type_, datetime.time):
                    return datetime.datetime.strptime(
                        decrypted_value, '%H:%M:%S'
                    ).time()

                elif issubclass(type_, datetime.date):
                    return datetime.datetime.strptime(
                        decrypted_value, '%Y-%m-%d'
                    ).date()

                # Handle all others
                return self.underlying_type.python_type(decrypted_value)

    def _coerce(self, value):
        if isinstance(self.underlying_type, ScalarCoercible):
            return self.underlying_type._coerce(value)

        return value
