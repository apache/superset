from .compat import py27, binary_type, string_types
import sys
from sqlalchemy.engine import url
import warnings
import textwrap
import collections
import logging

log = logging.getLogger(__name__)

if py27:
    # disable "no handler found" errors
    logging.getLogger('alembic').addHandler(logging.NullHandler())


try:
    import fcntl
    import termios
    import struct
    ioctl = fcntl.ioctl(0, termios.TIOCGWINSZ,
                        struct.pack('HHHH', 0, 0, 0, 0))
    _h, TERMWIDTH, _hp, _wp = struct.unpack('HHHH', ioctl)
    if TERMWIDTH <= 0:  # can occur if running in emacs pseudo-tty
        TERMWIDTH = None
except (ImportError, IOError):
    TERMWIDTH = None


def write_outstream(stream, *text):
    encoding = getattr(stream, 'encoding', 'ascii') or 'ascii'
    for t in text:
        if not isinstance(t, binary_type):
            t = t.encode(encoding, 'replace')
        t = t.decode(encoding)
        try:
            stream.write(t)
        except IOError:
            # suppress "broken pipe" errors.
            # no known way to handle this on Python 3 however
            # as the exception is "ignored" (noisily) in TextIOWrapper.
            break


def status(_statmsg, fn, *arg, **kw):
    msg(_statmsg + " ...", False)
    try:
        ret = fn(*arg, **kw)
        write_outstream(sys.stdout, " done\n")
        return ret
    except:
        write_outstream(sys.stdout, " FAILED\n")
        raise


def err(message):
    log.error(message)
    msg("FAILED: %s" % message)
    sys.exit(-1)


def obfuscate_url_pw(u):
    u = url.make_url(u)
    if u.password:
        u.password = 'XXXXX'
    return str(u)


def warn(msg):
    warnings.warn(msg)


def msg(msg, newline=True):
    if TERMWIDTH is None:
        write_outstream(sys.stdout, msg)
        if newline:
            write_outstream(sys.stdout, "\n")
    else:
        # left indent output lines
        lines = textwrap.wrap(msg, TERMWIDTH)
        if len(lines) > 1:
            for line in lines[0:-1]:
                write_outstream(sys.stdout, "  ", line, "\n")
        write_outstream(sys.stdout, "  ", lines[-1], ("\n" if newline else ""))


def format_as_comma(value):
    if value is None:
        return ""
    elif isinstance(value, string_types):
        return value
    elif isinstance(value, collections.Iterable):
        return ", ".join(value)
    else:
        raise ValueError("Don't know how to comma-format %r" % value)
