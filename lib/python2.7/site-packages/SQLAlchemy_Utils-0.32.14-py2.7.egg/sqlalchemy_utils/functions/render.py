import inspect

import six
import sqlalchemy as sa

from .mock import create_mock_engine


def render_expression(expression, bind, stream=None):
    """Generate a SQL expression from the passed python expression.

    Only the global variable, `engine`, is available for use in the
    expression. Additional local variables may be passed in the context
    parameter.

    Note this function is meant for convenience and protected usage. Do NOT
    blindly pass user input to this function as it uses exec.

    :param bind: A SQLAlchemy engine or bind URL.
    :param stream: Render all DDL operations to the stream.
    """

    # Create a stream if not present.

    if stream is None:
        stream = six.moves.cStringIO()

    engine = create_mock_engine(bind, stream)

    # Navigate the stack and find the calling frame that allows the
    # expression to execuate.

    for frame in inspect.stack()[1:]:
        try:
            frame = frame[0]
            local = dict(frame.f_locals)
            local['engine'] = engine
            six.exec_(expression, frame.f_globals, local)
            break
        except:
            pass
    else:
        raise ValueError('Not a valid python expression', engine)

    return stream


def render_statement(statement, bind=None):
    """
    Generate an SQL expression string with bound parameters rendered inline
    for the given SQLAlchemy statement.

    :param statement: SQLAlchemy Query object.
    :param bind:
        Optional SQLAlchemy bind, if None uses the bind of the given query
        object.
    """

    if isinstance(statement, sa.orm.query.Query):
        if bind is None:
            bind = statement.session.get_bind(statement._mapper_zero())

        statement = statement.statement

    elif bind is None:
        bind = statement.bind

    stream = six.moves.cStringIO()
    engine = create_mock_engine(bind.engine, stream=stream)
    engine.execute(statement)

    return stream.getvalue()
