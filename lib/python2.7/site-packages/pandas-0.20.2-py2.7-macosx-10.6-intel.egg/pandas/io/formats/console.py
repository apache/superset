"""
Internal module for console introspection
"""

import sys
import locale
from pandas.io.formats.terminal import get_terminal_size

# -----------------------------------------------------------------------------
# Global formatting options
_initial_defencoding = None


def detect_console_encoding():
    """
    Try to find the most capable encoding supported by the console.
    slighly modified from the way IPython handles the same issue.
    """
    global _initial_defencoding

    encoding = None
    try:
        encoding = sys.stdout.encoding or sys.stdin.encoding
    except AttributeError:
        pass

    # try again for something better
    if not encoding or 'ascii' in encoding.lower():
        try:
            encoding = locale.getpreferredencoding()
        except Exception:
            pass

    # when all else fails. this will usually be "ascii"
    if not encoding or 'ascii' in encoding.lower():
        encoding = sys.getdefaultencoding()

    # GH3360, save the reported defencoding at import time
    # MPL backends may change it. Make available for debugging.
    if not _initial_defencoding:
        _initial_defencoding = sys.getdefaultencoding()

    return encoding


def get_console_size():
    """Return console size as tuple = (width, height).

    Returns (None,None) in non-interactive session.
    """
    from pandas import get_option
    from pandas.core import common as com

    display_width = get_option('display.width')
    # deprecated.
    display_height = get_option('display.height', silent=True)

    # Consider
    # interactive shell terminal, can detect term size
    # interactive non-shell terminal (ipnb/ipqtconsole), cannot detect term
    # size non-interactive script, should disregard term size

    # in addition
    # width,height have default values, but setting to 'None' signals
    # should use Auto-Detection, But only in interactive shell-terminal.
    # Simple. yeah.

    if com.in_interactive_session():
        if com.in_ipython_frontend():
            # sane defaults for interactive non-shell terminal
            # match default for width,height in config_init
            from pandas.core.config import get_default_val
            terminal_width = get_default_val('display.width')
            terminal_height = get_default_val('display.height')
        else:
            # pure terminal
            terminal_width, terminal_height = get_terminal_size()
    else:
        terminal_width, terminal_height = None, None

    # Note if the User sets width/Height to None (auto-detection)
    # and we're in a script (non-inter), this will return (None,None)
    # caller needs to deal.
    return (display_width or terminal_width, display_height or terminal_height)
