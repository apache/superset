import sqlalchemy as sa

from ..operators import CaseInsensitiveComparator


class EmailType(sa.types.TypeDecorator):
    """
    Provides a way for storing emails in a lower case.

    Example::


        from sqlalchemy_utils import EmailType


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            email = sa.Column(EmailType)


        user = User()
        user.email = 'John.Smith@foo.com'
        user.name = 'John Smith'
        session.add(user)
        session.commit()
        # Notice - email in filter() is lowercase.
        user = (session.query(User)
                       .filter(User.email == 'john.smith@foo.com')
                       .one())
        assert user.name == 'John Smith'
    """
    impl = sa.Unicode
    comparator_factory = CaseInsensitiveComparator

    def __init__(self, length=255, *args, **kwargs):
        super(EmailType, self).__init__(length=length, *args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is not None:
            return value.lower()
        return value

    @property
    def python_type(self):
        return self.impl.type.python_type
