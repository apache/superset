#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

import logging
import os
import socket
import ssl
import sys
import warnings

from .sslcompat import _match_hostname, _match_has_ipaddress
from thrift.transport import TSocket
from thrift.transport.TTransport import TTransportException

logger = logging.getLogger(__name__)
warnings.filterwarnings(
    'default', category=DeprecationWarning, module=__name__)


class TSSLBase(object):
    # SSLContext is not available for Python < 2.7.9
    _has_ssl_context = sys.hexversion >= 0x020709F0

    # ciphers argument is not available for Python < 2.7.0
    _has_ciphers = sys.hexversion >= 0x020700F0

    # For pythoon >= 2.7.9, use latest TLS that both client and server
    # supports.
    # SSL 2.0 and 3.0 are disabled via ssl.OP_NO_SSLv2 and ssl.OP_NO_SSLv3.
    # For pythoon < 2.7.9, use TLS 1.0 since TLSv1_X nor OP_NO_SSLvX is
    # unavailable.
    _default_protocol = ssl.PROTOCOL_SSLv23 if _has_ssl_context else \
        ssl.PROTOCOL_TLSv1

    def _init_context(self, ssl_version):
        if self._has_ssl_context:
            self._context = ssl.SSLContext(ssl_version)
            if self._context.protocol == ssl.PROTOCOL_SSLv23:
                self._context.options |= ssl.OP_NO_SSLv2
                self._context.options |= ssl.OP_NO_SSLv3
        else:
            self._context = None
            self._ssl_version = ssl_version

    @property
    def _should_verify(self):
        if self._has_ssl_context:
            return self._context.verify_mode != ssl.CERT_NONE
        else:
            return self.cert_reqs != ssl.CERT_NONE

    @property
    def ssl_version(self):
        if self._has_ssl_context:
            return self.ssl_context.protocol
        else:
            return self._ssl_version

    @property
    def ssl_context(self):
        return self._context

    SSL_VERSION = _default_protocol
    """
  Default SSL version.
  For backword compatibility, it can be modified.
  Use __init__ keywoard argument "ssl_version" instead.
  """

    def _deprecated_arg(self, args, kwargs, pos, key):
        if len(args) <= pos:
            return
        real_pos = pos + 3
        warnings.warn(
            '%dth positional argument is deprecated.'
            'please use keyward argument insteand.'
            % real_pos, DeprecationWarning, stacklevel=3)

        if key in kwargs:
            raise TypeError(
                'Duplicate argument: %dth argument and %s keyward argument.'
                % (real_pos, key))
        kwargs[key] = args[pos]

    def _unix_socket_arg(self, host, port, args, kwargs):
        key = 'unix_socket'
        if host is None and port is None and len(args) == 1 and key not in kwargs:
            kwargs[key] = args[0]
            return True
        return False

    def __getattr__(self, key):
        if key == 'SSL_VERSION':
            warnings.warn(
                'SSL_VERSION is deprecated.'
                'please use ssl_version attribute instead.',
                DeprecationWarning, stacklevel=2)
            return self.ssl_version

    def __init__(self, server_side, host, ssl_opts):
        self._server_side = server_side
        if TSSLBase.SSL_VERSION != self._default_protocol:
            warnings.warn(
                'SSL_VERSION is deprecated.'
                'please use ssl_version keyward argument instead.',
                DeprecationWarning, stacklevel=2)
        self._context = ssl_opts.pop('ssl_context', None)
        self._server_hostname = None
        if not self._server_side:
            self._server_hostname = ssl_opts.pop('server_hostname', host)
        if self._context:
            self._custom_context = True
            if ssl_opts:
                raise ValueError(
                    'Incompatible arguments: ssl_context and %s'
                    % ' '.join(ssl_opts.keys()))
            if not self._has_ssl_context:
                raise ValueError(
                    'ssl_context is not available for this version of Python')
        else:
            self._custom_context = False
            ssl_version = ssl_opts.pop('ssl_version', TSSLBase.SSL_VERSION)
            self._init_context(ssl_version)
            self.cert_reqs = ssl_opts.pop('cert_reqs', ssl.CERT_REQUIRED)
            self.ca_certs = ssl_opts.pop('ca_certs', None)
            self.keyfile = ssl_opts.pop('keyfile', None)
            self.certfile = ssl_opts.pop('certfile', None)
            self.ciphers = ssl_opts.pop('ciphers', None)

            if ssl_opts:
                raise ValueError(
                    'Unknown keyword arguments: ', ' '.join(ssl_opts.keys()))

            if self._should_verify:
                if not self.ca_certs:
                    raise ValueError(
                        'ca_certs is needed when cert_reqs is not ssl.CERT_NONE')
                if not os.access(self.ca_certs, os.R_OK):
                    raise IOError('Certificate Authority ca_certs file "%s" '
                                  'is not readable, cannot validate SSL '
                                  'certificates.' % (self.ca_certs))

    @property
    def certfile(self):
        return self._certfile

    @certfile.setter
    def certfile(self, certfile):
        if self._server_side and not certfile:
            raise ValueError('certfile is needed for server-side')
        if certfile and not os.access(certfile, os.R_OK):
            raise IOError('No such certfile found: %s' % (certfile))
        self._certfile = certfile

    def _wrap_socket(self, sock):
        if self._has_ssl_context:
            if not self._custom_context:
                self.ssl_context.verify_mode = self.cert_reqs
                if self.certfile:
                    self.ssl_context.load_cert_chain(self.certfile,
                                                     self.keyfile)
                if self.ciphers:
                    self.ssl_context.set_ciphers(self.ciphers)
                if self.ca_certs:
                    self.ssl_context.load_verify_locations(self.ca_certs)
            return self.ssl_context.wrap_socket(
                sock, server_side=self._server_side,
                server_hostname=self._server_hostname)
        else:
            ssl_opts = {
                'ssl_version': self._ssl_version,
                'server_side': self._server_side,
                'ca_certs': self.ca_certs,
                'keyfile': self.keyfile,
                'certfile': self.certfile,
                'cert_reqs': self.cert_reqs,
            }
            if self.ciphers:
                if self._has_ciphers:
                    ssl_opts['ciphers'] = self.ciphers
                else:
                    logger.warning(
                        'ciphers is specified but ignored due to old Python version')
            return ssl.wrap_socket(sock, **ssl_opts)


class TSSLSocket(TSocket.TSocket, TSSLBase):
    """
    SSL implementation of TSocket

    This class creates outbound sockets wrapped using the
    python standard ssl module for encrypted connections.
    """

    # New signature
    # def __init__(self, host='localhost', port=9090, unix_socket=None,
    #              **ssl_args):
    # Deprecated signature
    # def __init__(self, host='localhost', port=9090, validate=True,
    #              ca_certs=None, keyfile=None, certfile=None,
    #              unix_socket=None, ciphers=None):
    def __init__(self, host='localhost', port=9090, *args, **kwargs):
        """Positional arguments: ``host``, ``port``, ``unix_socket``

        Keyword arguments: ``keyfile``, ``certfile``, ``cert_reqs``,
                           ``ssl_version``, ``ca_certs``,
                           ``ciphers`` (Python 2.7.0 or later),
                           ``server_hostname`` (Python 2.7.9 or later)
        Passed to ssl.wrap_socket. See ssl.wrap_socket documentation.

        Alternative keyword arguments: (Python 2.7.9 or later)
          ``ssl_context``: ssl.SSLContext to be used for SSLContext.wrap_socket
          ``server_hostname``: Passed to SSLContext.wrap_socket

        Common keyword argument:
          ``validate_callback`` (cert, hostname) -> None:
              Called after SSL handshake. Can raise when hostname does not
              match the cert.
        """
        self.is_valid = False
        self.peercert = None

        if args:
            if len(args) > 6:
                raise TypeError('Too many positional argument')
            if not self._unix_socket_arg(host, port, args, kwargs):
                self._deprecated_arg(args, kwargs, 0, 'validate')
            self._deprecated_arg(args, kwargs, 1, 'ca_certs')
            self._deprecated_arg(args, kwargs, 2, 'keyfile')
            self._deprecated_arg(args, kwargs, 3, 'certfile')
            self._deprecated_arg(args, kwargs, 4, 'unix_socket')
            self._deprecated_arg(args, kwargs, 5, 'ciphers')

        validate = kwargs.pop('validate', None)
        if validate is not None:
            cert_reqs_name = 'CERT_REQUIRED' if validate else 'CERT_NONE'
            warnings.warn(
                'validate is deprecated. please use cert_reqs=ssl.%s instead'
                % cert_reqs_name,
                DeprecationWarning, stacklevel=2)
            if 'cert_reqs' in kwargs:
                raise TypeError('Cannot specify both validate and cert_reqs')
            kwargs['cert_reqs'] = ssl.CERT_REQUIRED if validate else ssl.CERT_NONE

        unix_socket = kwargs.pop('unix_socket', None)
        self._validate_callback = kwargs.pop('validate_callback', _match_hostname)
        TSSLBase.__init__(self, False, host, kwargs)
        TSocket.TSocket.__init__(self, host, port, unix_socket)

    @property
    def validate(self):
        warnings.warn('validate is deprecated. please use cert_reqs instead',
                      DeprecationWarning, stacklevel=2)
        return self.cert_reqs != ssl.CERT_NONE

    @validate.setter
    def validate(self, value):
        warnings.warn('validate is deprecated. please use cert_reqs instead',
                      DeprecationWarning, stacklevel=2)
        self.cert_reqs = ssl.CERT_REQUIRED if value else ssl.CERT_NONE

    def _do_open(self, family, socktype):
        plain_sock = socket.socket(family, socktype)
        try:
            return self._wrap_socket(plain_sock)
        except Exception:
            plain_sock.close()
            msg = 'failed to initialize SSL'
            logger.exception(msg)
            raise TTransportException(TTransportException.NOT_OPEN, msg)

    def open(self):
        super(TSSLSocket, self).open()
        if self._should_verify:
            self.peercert = self.handle.getpeercert()
            try:
                self._validate_callback(self.peercert, self._server_hostname)
                self.is_valid = True
            except TTransportException:
                raise
            except Exception as ex:
                raise TTransportException(TTransportException.UNKNOWN, str(ex))


class TSSLServerSocket(TSocket.TServerSocket, TSSLBase):
    """SSL implementation of TServerSocket

    This uses the ssl module's wrap_socket() method to provide SSL
    negotiated encryption.
    """

    # New signature
    # def __init__(self, host='localhost', port=9090, unix_socket=None, **ssl_args):
    # Deprecated signature
    # def __init__(self, host=None, port=9090, certfile='cert.pem', unix_socket=None, ciphers=None):
    def __init__(self, host=None, port=9090, *args, **kwargs):
        """Positional arguments: ``host``, ``port``, ``unix_socket``

        Keyword arguments: ``keyfile``, ``certfile``, ``cert_reqs``, ``ssl_version``,
                           ``ca_certs``, ``ciphers`` (Python 2.7.0 or later)
        See ssl.wrap_socket documentation.

        Alternative keyword arguments: (Python 2.7.9 or later)
          ``ssl_context``: ssl.SSLContext to be used for SSLContext.wrap_socket
          ``server_hostname``: Passed to SSLContext.wrap_socket

        Common keyword argument:
          ``validate_callback`` (cert, hostname) -> None:
              Called after SSL handshake. Can raise when hostname does not
              match the cert.
        """
        if args:
            if len(args) > 3:
                raise TypeError('Too many positional argument')
            if not self._unix_socket_arg(host, port, args, kwargs):
                self._deprecated_arg(args, kwargs, 0, 'certfile')
            self._deprecated_arg(args, kwargs, 1, 'unix_socket')
            self._deprecated_arg(args, kwargs, 2, 'ciphers')

        if 'ssl_context' not in kwargs:
            # Preserve existing behaviors for default values
            if 'cert_reqs' not in kwargs:
                kwargs['cert_reqs'] = ssl.CERT_NONE
            if'certfile' not in kwargs:
                kwargs['certfile'] = 'cert.pem'

        unix_socket = kwargs.pop('unix_socket', None)
        self._validate_callback = \
            kwargs.pop('validate_callback', _match_hostname)
        TSSLBase.__init__(self, True, None, kwargs)
        TSocket.TServerSocket.__init__(self, host, port, unix_socket)
        if self._should_verify and not _match_has_ipaddress:
            raise ValueError('Need ipaddress and backports.ssl_match_hostname '
                             'module to verify client certificate')

    def setCertfile(self, certfile):
        """Set or change the server certificate file used to wrap new
        connections.

        @param certfile: The filename of the server certificate,
                         i.e. '/etc/certs/server.pem'
        @type certfile: str

        Raises an IOError exception if the certfile is not present or unreadable.
        """
        warnings.warn(
            'setCertfile is deprecated. please use certfile property instead.',
            DeprecationWarning, stacklevel=2)
        self.certfile = certfile

    def accept(self):
        plain_client, addr = self.handle.accept()
        try:
            client = self._wrap_socket(plain_client)
        except ssl.SSLError:
            logger.exception('Error while accepting from %s', addr)
            # failed handshake/ssl wrap, close socket to client
            plain_client.close()
            # raise
            # We can't raise the exception, because it kills most TServer derived
            # serve() methods.
            # Instead, return None, and let the TServer instance deal with it in
            # other exception handling.  (but TSimpleServer dies anyway)
            return None

        if self._should_verify:
            client.peercert = client.getpeercert()
            try:
                self._validate_callback(client.peercert, addr[0])
                client.is_valid = True
            except Exception:
                logger.warn('Failed to validate client certificate address: %s',
                            addr[0], exc_info=True)
                client.close()
                plain_client.close()
                return None

        result = TSocket.TSocket()
        result.handle = client
        return result
