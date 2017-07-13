"""
kombu.transport.filesystem
==========================

Transport using the file system as the message store.

"""
from __future__ import absolute_import

from anyjson import loads, dumps

import os
import shutil
import uuid
import tempfile

from . import virtual
from kombu.exceptions import ChannelError
from kombu.five import Empty, monotonic
from kombu.utils import cached_property
from kombu.utils.encoding import bytes_to_str, str_to_bytes

VERSION = (1, 0, 0)
__version__ = '.'.join(map(str, VERSION))

# needs win32all to work on Windows
if os.name == 'nt':

    import win32con
    import win32file
    import pywintypes

    LOCK_EX = win32con.LOCKFILE_EXCLUSIVE_LOCK
    # 0 is the default
    LOCK_SH = 0                                     # noqa
    LOCK_NB = win32con.LOCKFILE_FAIL_IMMEDIATELY    # noqa
    __overlapped = pywintypes.OVERLAPPED()

    def lock(file, flags):
        hfile = win32file._get_osfhandle(file.fileno())
        win32file.LockFileEx(hfile, flags, 0, 0xffff0000, __overlapped)

    def unlock(file):
        hfile = win32file._get_osfhandle(file.fileno())
        win32file.UnlockFileEx(hfile, 0, 0xffff0000, __overlapped)

elif os.name == 'posix':

    import fcntl
    from fcntl import LOCK_EX, LOCK_SH, LOCK_NB     # noqa

    def lock(file, flags):  # noqa
        fcntl.flock(file.fileno(), flags)

    def unlock(file):       # noqa
        fcntl.flock(file.fileno(), fcntl.LOCK_UN)
else:
    raise RuntimeError(
        'Filesystem plugin only defined for NT and POSIX platforms')


class Channel(virtual.Channel):

    def _put(self, queue, payload, **kwargs):
        """Put `message` onto `queue`."""

        filename = '%s_%s.%s.msg' % (int(round(monotonic() * 1000)),
                                     uuid.uuid4(), queue)
        filename = os.path.join(self.data_folder_out, filename)

        try:
            f = open(filename, 'wb')
            lock(f, LOCK_EX)
            f.write(str_to_bytes(dumps(payload)))
        except (IOError, OSError):
            raise ChannelError(
                'Cannot add file {0!r} to directory'.format(filename))
        finally:
            unlock(f)
            f.close()

    def _get(self, queue):
        """Get next message from `queue`."""

        queue_find = '.' + queue + '.msg'
        folder = os.listdir(self.data_folder_in)
        folder = sorted(folder)
        while len(folder) > 0:
            filename = folder.pop(0)

            # only handle message for the requested queue
            if filename.find(queue_find) < 0:
                continue

            if self.store_processed:
                processed_folder = self.processed_folder
            else:
                processed_folder = tempfile.gettempdir()

            try:
                # move the file to the tmp/processed folder
                shutil.move(os.path.join(self.data_folder_in, filename),
                            processed_folder)
            except IOError:
                pass  # file could be locked, or removed in meantime so ignore

            filename = os.path.join(processed_folder, filename)
            try:
                f = open(filename, 'rb')
                payload = f.read()
                f.close()
                if not self.store_processed:
                    os.remove(filename)
            except (IOError, OSError):
                raise ChannelError(
                    'Cannot read file {0!r} from queue.'.format(filename))

            return loads(bytes_to_str(payload))

        raise Empty()

    def _purge(self, queue):
        """Remove all messages from `queue`."""
        count = 0
        queue_find = '.' + queue + '.msg'

        folder = os.listdir(self.data_folder_in)
        while len(folder) > 0:
            filename = folder.pop()
            try:
                # only purge messages for the requested queue
                if filename.find(queue_find) < 0:
                    continue

                filename = os.path.join(self.data_folder_in, filename)
                os.remove(filename)

                count += 1

            except OSError:
                # we simply ignore its existence, as it was probably
                # processed by another worker
                pass

        return count

    def _size(self, queue):
        """Return the number of messages in `queue` as an :class:`int`."""
        count = 0

        queue_find = '.{0}.msg'.format(queue)
        folder = os.listdir(self.data_folder_in)
        while len(folder) > 0:
            filename = folder.pop()

            # only handle message for the requested queue
            if filename.find(queue_find) < 0:
                continue

            count += 1

        return count

    @property
    def transport_options(self):
        return self.connection.client.transport_options

    @cached_property
    def data_folder_in(self):
        return self.transport_options.get('data_folder_in', 'data_in')

    @cached_property
    def data_folder_out(self):
        return self.transport_options.get('data_folder_out', 'data_out')

    @cached_property
    def store_processed(self):
        return self.transport_options.get('store_processed', False)

    @cached_property
    def processed_folder(self):
        return self.transport_options.get('processed_folder', 'processed')


class Transport(virtual.Transport):
    Channel = Channel

    default_port = 0
    driver_type = 'filesystem'
    driver_name = 'filesystem'

    def driver_version(self):
        return 'N/A'
