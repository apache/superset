"""
Pyperclip

A cross-platform clipboard module for Python. (only handles plain text for now)
By Al Sweigart al@inventwithpython.com
BSD License

Usage:
  import pyperclip
  pyperclip.copy('The text to be copied to the clipboard.')
  spam = pyperclip.paste()

  if not pyperclip.copy:
    print("Copy functionality unavailable!")

On Windows, no additional modules are needed.
On Mac, the module uses pbcopy and pbpaste, which should come with the os.
On Linux, install xclip or xsel via package manager. For example, in Debian:
sudo apt-get install xclip

Otherwise on Linux, you will need the gtk or PyQt4 modules installed.

gtk and PyQt4 modules are not available for Python 3,
and this module does not work with PyGObject yet.
"""
__version__ = '1.5.27'

import platform
import os
import subprocess
from .clipboards import (init_osx_clipboard,
                         init_gtk_clipboard, init_qt_clipboard,
                         init_xclip_clipboard, init_xsel_clipboard,
                         init_klipper_clipboard, init_no_clipboard)
from .windows import init_windows_clipboard

# `import PyQt4` sys.exit()s if DISPLAY is not in the environment.
# Thus, we need to detect the presence of $DISPLAY manually
# and not load PyQt4 if it is absent.
HAS_DISPLAY = os.getenv("DISPLAY", False)
CHECK_CMD = "where" if platform.system() == "Windows" else "which"


def _executable_exists(name):
    return subprocess.call([CHECK_CMD, name],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE) == 0


def determine_clipboard():
    # Determine the OS/platform and set
    # the copy() and paste() functions accordingly.
    if 'cygwin' in platform.system().lower():
        # FIXME: pyperclip currently does not support Cygwin,
        # see https://github.com/asweigart/pyperclip/issues/55
        pass
    elif os.name == 'nt' or platform.system() == 'Windows':
        return init_windows_clipboard()
    if os.name == 'mac' or platform.system() == 'Darwin':
        return init_osx_clipboard()
    if HAS_DISPLAY:
        # Determine which command/module is installed, if any.
        try:
            # Check if gtk is installed
            import gtk  # noqa
        except ImportError:
            pass
        else:
            return init_gtk_clipboard()

        try:
            # Check if PyQt4 is installed
            import PyQt4  # noqa
        except ImportError:
            pass
        else:
            return init_qt_clipboard()

        if _executable_exists("xclip"):
            return init_xclip_clipboard()
        if _executable_exists("xsel"):
            return init_xsel_clipboard()
        if _executable_exists("klipper") and _executable_exists("qdbus"):
            return init_klipper_clipboard()

    return init_no_clipboard()


def set_clipboard(clipboard):
    global copy, paste

    clipboard_types = {'osx': init_osx_clipboard,
                       'gtk': init_gtk_clipboard,
                       'qt': init_qt_clipboard,
                       'xclip': init_xclip_clipboard,
                       'xsel': init_xsel_clipboard,
                       'klipper': init_klipper_clipboard,
                       'windows': init_windows_clipboard,
                       'no': init_no_clipboard}

    copy, paste = clipboard_types[clipboard]()


copy, paste = determine_clipboard()

__all__ = ["copy", "paste"]


# pandas aliases
clipboard_get = paste
clipboard_set = copy
