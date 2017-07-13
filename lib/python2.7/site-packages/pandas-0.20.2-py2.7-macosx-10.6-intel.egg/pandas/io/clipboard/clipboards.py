import sys
import subprocess
from .exceptions import PyperclipException

EXCEPT_MSG = """
    Pyperclip could not find a copy/paste mechanism for your system.
    For more information, please visit https://pyperclip.readthedocs.org """
PY2 = sys.version_info[0] == 2
text_type = unicode if PY2 else str  # noqa


def init_osx_clipboard():
    def copy_osx(text):
        p = subprocess.Popen(['pbcopy', 'w'],
                             stdin=subprocess.PIPE, close_fds=True)
        p.communicate(input=text.encode('utf-8'))

    def paste_osx():
        p = subprocess.Popen(['pbpaste', 'r'],
                             stdout=subprocess.PIPE, close_fds=True)
        stdout, stderr = p.communicate()
        return stdout.decode('utf-8')

    return copy_osx, paste_osx


def init_gtk_clipboard():
    import gtk

    def copy_gtk(text):
        global cb
        cb = gtk.Clipboard()
        cb.set_text(text)
        cb.store()

    def paste_gtk():
        clipboardContents = gtk.Clipboard().wait_for_text()
        # for python 2, returns None if the clipboard is blank.
        if clipboardContents is None:
            return ''
        else:
            return clipboardContents

    return copy_gtk, paste_gtk


def init_qt_clipboard():
    # $DISPLAY should exist
    from PyQt4.QtGui import QApplication

    # use the global instance if it exists
    app = QApplication.instance() or QApplication([])

    def copy_qt(text):
        cb = app.clipboard()
        cb.setText(text)

    def paste_qt():
        cb = app.clipboard()
        return text_type(cb.text())

    return copy_qt, paste_qt


def init_xclip_clipboard():
    def copy_xclip(text):
        p = subprocess.Popen(['xclip', '-selection', 'c'],
                             stdin=subprocess.PIPE, close_fds=True)
        p.communicate(input=text.encode('utf-8'))

    def paste_xclip():
        p = subprocess.Popen(['xclip', '-selection', 'c', '-o'],
                             stdout=subprocess.PIPE, close_fds=True)
        stdout, stderr = p.communicate()
        return stdout.decode('utf-8')

    return copy_xclip, paste_xclip


def init_xsel_clipboard():
    def copy_xsel(text):
        p = subprocess.Popen(['xsel', '-b', '-i'],
                             stdin=subprocess.PIPE, close_fds=True)
        p.communicate(input=text.encode('utf-8'))

    def paste_xsel():
        p = subprocess.Popen(['xsel', '-b', '-o'],
                             stdout=subprocess.PIPE, close_fds=True)
        stdout, stderr = p.communicate()
        return stdout.decode('utf-8')

    return copy_xsel, paste_xsel


def init_klipper_clipboard():
    def copy_klipper(text):
        p = subprocess.Popen(
            ['qdbus', 'org.kde.klipper', '/klipper', 'setClipboardContents',
             text.encode('utf-8')],
            stdin=subprocess.PIPE, close_fds=True)
        p.communicate(input=None)

    def paste_klipper():
        p = subprocess.Popen(
            ['qdbus', 'org.kde.klipper', '/klipper', 'getClipboardContents'],
            stdout=subprocess.PIPE, close_fds=True)
        stdout, stderr = p.communicate()

        # Workaround for https://bugs.kde.org/show_bug.cgi?id=342874
        # TODO: https://github.com/asweigart/pyperclip/issues/43
        clipboardContents = stdout.decode('utf-8')
        # even if blank, Klipper will append a newline at the end
        assert len(clipboardContents) > 0
        # make sure that newline is there
        assert clipboardContents.endswith('\n')
        if clipboardContents.endswith('\n'):
            clipboardContents = clipboardContents[:-1]
        return clipboardContents

    return copy_klipper, paste_klipper


def init_no_clipboard():
    class ClipboardUnavailable(object):

        def __call__(self, *args, **kwargs):
            raise PyperclipException(EXCEPT_MSG)

        if PY2:
            def __nonzero__(self):
                return False
        else:
            def __bool__(self):
                return False

    return ClipboardUnavailable(), ClipboardUnavailable()
