import contextlib
import datetime
import inspect
import re

import six
import sqlalchemy as sa


def create_mock_engine(bind, stream=None):
    """Create a mock SQLAlchemy engine from the passed engine or bind URL.

    :param bind: A SQLAlchemy engine or bind URL to mock.
    :param stream: Render all DDL operations to the stream.
    """

    if not isinstance(bind, six.string_types):
        bind_url = str(bind.url)

    else:
        bind_url = bind

    if stream is not None:

        def dump(sql, *args, **kwargs):

            class Compiler(type(sql._compiler(engine.dialect))):

                def visit_bindparam(self, bindparam, *args, **kwargs):
                    return self.render_literal_value(
                        bindparam.value, bindparam.type)

                def render_literal_value(self, value, type_):
                    if isinstance(value, six.integer_types):
                        return str(value)

                    elif isinstance(value, (datetime.date, datetime.datetime)):
                        return "'%s'" % value

                    return super(Compiler, self).render_literal_value(
                        value, type_)

            text = str(Compiler(engine.dialect, sql).process(sql))
            text = re.sub(r'\n+', '\n', text)
            text = text.strip('\n').strip()

            stream.write('\n%s;' % text)

    else:
        def dump(*args, **kw):
            return None

    engine = sa.create_engine(bind_url, strategy='mock', executor=dump)
    return engine


@contextlib.contextmanager
def mock_engine(engine, stream=None):
    """Mocks out the engine specified in the passed bind expression.

    Note this function is meant for convenience and protected usage. Do NOT
    blindly pass user input to this function as it uses exec.

    :param engine: A python expression that represents the engine to mock.
    :param stream: Render all DDL operations to the stream.
    """

    # Create a stream if not present.

    if stream is None:
        stream = six.moves.cStringIO()

    # Navigate the stack and find the calling frame that allows the
    # expression to execuate.

    for frame in inspect.stack()[1:]:

        try:
            frame = frame[0]
            expression = '__target = %s' % engine
            six.exec_(expression, frame.f_globals, frame.f_locals)
            target = frame.f_locals['__target']
            break

        except:
            pass

    else:

        raise ValueError('Not a valid python expression', engine)

    # Evaluate the expression and get the target engine.

    frame.f_locals['__mock'] = create_mock_engine(target, stream)

    # Replace the target with our mock.

    six.exec_('%s = __mock' % engine, frame.f_globals, frame.f_locals)

    # Give control back.

    yield stream

    # Put the target engine back.

    frame.f_locals['__target'] = target
    six.exec_('%s = __target' % engine, frame.f_globals, frame.f_locals)
    six.exec_('del __target', frame.f_globals, frame.f_locals)
    six.exec_('del __mock', frame.f_globals, frame.f_locals)
