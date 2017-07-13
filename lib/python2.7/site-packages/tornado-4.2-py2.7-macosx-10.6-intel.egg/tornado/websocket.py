"""Implementation of the WebSocket protocol.

`WebSockets <http://dev.w3.org/html5/websockets/>`_ allow for bidirectional
communication between the browser and server.

WebSockets are supported in the current versions of all major browsers,
although older versions that do not support WebSockets are still in use
(refer to http://caniuse.com/websockets for details).

This module implements the final version of the WebSocket protocol as
defined in `RFC 6455 <http://tools.ietf.org/html/rfc6455>`_.  Certain
browser versions (notably Safari 5.x) implemented an earlier draft of
the protocol (known as "draft 76") and are not compatible with this module.

.. versionchanged:: 4.0
   Removed support for the draft 76 protocol version.
"""

from __future__ import (absolute_import, division,
                        print_function, with_statement)
# Author: Jacob Kristhammar, 2010

import base64
import collections
import hashlib
import os
import struct
import tornado.escape
import tornado.web
import zlib

from tornado.concurrent import TracebackFuture
from tornado.escape import utf8, native_str, to_unicode
from tornado import httpclient, httputil
from tornado.ioloop import IOLoop
from tornado.iostream import StreamClosedError
from tornado.log import gen_log, app_log
from tornado import simple_httpclient
from tornado.tcpclient import TCPClient
from tornado.util import _websocket_mask

try:
    from urllib.parse import urlparse  # py2
except ImportError:
    from urlparse import urlparse  # py3

try:
    xrange  # py2
except NameError:
    xrange = range  # py3


class WebSocketError(Exception):
    pass


class WebSocketClosedError(WebSocketError):
    """Raised by operations on a closed connection.

    .. versionadded:: 3.2
    """
    pass


class WebSocketHandler(tornado.web.RequestHandler):
    """Subclass this class to create a basic WebSocket handler.

    Override `on_message` to handle incoming messages, and use
    `write_message` to send messages to the client. You can also
    override `open` and `on_close` to handle opened and closed
    connections.

    See http://dev.w3.org/html5/websockets/ for details on the
    JavaScript interface.  The protocol is specified at
    http://tools.ietf.org/html/rfc6455.

    Here is an example WebSocket handler that echos back all received messages
    back to the client:

    .. testcode::

      class EchoWebSocket(tornado.websocket.WebSocketHandler):
          def open(self):
              print("WebSocket opened")

          def on_message(self, message):
              self.write_message(u"You said: " + message)

          def on_close(self):
              print("WebSocket closed")

    .. testoutput::
       :hide:

    WebSockets are not standard HTTP connections. The "handshake" is
    HTTP, but after the handshake, the protocol is
    message-based. Consequently, most of the Tornado HTTP facilities
    are not available in handlers of this type. The only communication
    methods available to you are `write_message()`, `ping()`, and
    `close()`. Likewise, your request handler class should implement
    `open()` method rather than ``get()`` or ``post()``.

    If you map the handler above to ``/websocket`` in your application, you can
    invoke it in JavaScript with::

      var ws = new WebSocket("ws://localhost:8888/websocket");
      ws.onopen = function() {
         ws.send("Hello, world");
      };
      ws.onmessage = function (evt) {
         alert(evt.data);
      };

    This script pops up an alert box that says "You said: Hello, world".

    Web browsers allow any site to open a websocket connection to any other,
    instead of using the same-origin policy that governs other network
    access from javascript.  This can be surprising and is a potential
    security hole, so since Tornado 4.0 `WebSocketHandler` requires
    applications that wish to receive cross-origin websockets to opt in
    by overriding the `~WebSocketHandler.check_origin` method (see that
    method's docs for details).  Failure to do so is the most likely
    cause of 403 errors when making a websocket connection.

    When using a secure websocket connection (``wss://``) with a self-signed
    certificate, the connection from a browser may fail because it wants
    to show the "accept this certificate" dialog but has nowhere to show it.
    You must first visit a regular HTML page using the same certificate
    to accept it before the websocket connection will succeed.
    """
    def __init__(self, application, request, **kwargs):
        tornado.web.RequestHandler.__init__(self, application, request,
                                            **kwargs)
        self.ws_connection = None
        self.close_code = None
        self.close_reason = None
        self.stream = None
        self._on_close_called = False

    @tornado.web.asynchronous
    def get(self, *args, **kwargs):
        self.open_args = args
        self.open_kwargs = kwargs

        # Upgrade header should be present and should be equal to WebSocket
        if self.request.headers.get("Upgrade", "").lower() != 'websocket':
            self.set_status(400)
            log_msg = "Can \"Upgrade\" only to \"WebSocket\"."
            self.finish(log_msg)
            gen_log.debug(log_msg)
            return

        # Connection header should be upgrade.
        # Some proxy servers/load balancers
        # might mess with it.
        headers = self.request.headers
        connection = map(lambda s: s.strip().lower(),
                         headers.get("Connection", "").split(","))
        if 'upgrade' not in connection:
            self.set_status(400)
            log_msg = "\"Connection\" must be \"Upgrade\"."
            self.finish(log_msg)
            gen_log.debug(log_msg)
            return

        # Handle WebSocket Origin naming convention differences
        # The difference between version 8 and 13 is that in 8 the
        # client sends a "Sec-Websocket-Origin" header and in 13 it's
        # simply "Origin".
        if "Origin" in self.request.headers:
            origin = self.request.headers.get("Origin")
        else:
            origin = self.request.headers.get("Sec-Websocket-Origin", None)

        # If there was an origin header, check to make sure it matches
        # according to check_origin. When the origin is None, we assume it
        # did not come from a browser and that it can be passed on.
        if origin is not None and not self.check_origin(origin):
            self.set_status(403)
            log_msg = "Cross origin websockets not allowed"
            self.finish(log_msg)
            gen_log.debug(log_msg)
            return

        self.stream = self.request.connection.detach()
        self.stream.set_close_callback(self.on_connection_close)

        self.ws_connection = self.get_websocket_protocol()
        if self.ws_connection:
            self.ws_connection.accept_connection()
        else:
            if not self.stream.closed():
                self.stream.write(tornado.escape.utf8(
                    "HTTP/1.1 426 Upgrade Required\r\n"
                    "Sec-WebSocket-Version: 7, 8, 13\r\n\r\n"))
                self.stream.close()

    def write_message(self, message, binary=False):
        """Sends the given message to the client of this Web Socket.

        The message may be either a string or a dict (which will be
        encoded as json).  If the ``binary`` argument is false, the
        message will be sent as utf8; in binary mode any byte string
        is allowed.

        If the connection is already closed, raises `WebSocketClosedError`.

        .. versionchanged:: 3.2
           `WebSocketClosedError` was added (previously a closed connection
           would raise an `AttributeError`)
        """
        if self.ws_connection is None:
            raise WebSocketClosedError()
        if isinstance(message, dict):
            message = tornado.escape.json_encode(message)
        self.ws_connection.write_message(message, binary=binary)

    def select_subprotocol(self, subprotocols):
        """Invoked when a new WebSocket requests specific subprotocols.

        ``subprotocols`` is a list of strings identifying the
        subprotocols proposed by the client.  This method may be
        overridden to return one of those strings to select it, or
        ``None`` to not select a subprotocol.  Failure to select a
        subprotocol does not automatically abort the connection,
        although clients may close the connection if none of their
        proposed subprotocols was selected.
        """
        return None

    def get_compression_options(self):
        """Override to return compression options for the connection.

        If this method returns None (the default), compression will
        be disabled.  If it returns a dict (even an empty one), it
        will be enabled.  The contents of the dict may be used to
        control the memory and CPU usage of the compression,
        but no such options are currently implemented.

        .. versionadded:: 4.1
        """
        return None

    def open(self, *args, **kwargs):
        """Invoked when a new WebSocket is opened.

        The arguments to `open` are extracted from the `tornado.web.URLSpec`
        regular expression, just like the arguments to
        `tornado.web.RequestHandler.get`.
        """
        pass

    def on_message(self, message):
        """Handle incoming messages on the WebSocket

        This method must be overridden.
        """
        raise NotImplementedError

    def ping(self, data):
        """Send ping frame to the remote end."""
        if self.ws_connection is None:
            raise WebSocketClosedError()
        self.ws_connection.write_ping(data)

    def on_pong(self, data):
        """Invoked when the response to a ping frame is received."""
        pass

    def on_close(self):
        """Invoked when the WebSocket is closed.

        If the connection was closed cleanly and a status code or reason
        phrase was supplied, these values will be available as the attributes
        ``self.close_code`` and ``self.close_reason``.

        .. versionchanged:: 4.0

           Added ``close_code`` and ``close_reason`` attributes.
        """
        pass

    def close(self, code=None, reason=None):
        """Closes this Web Socket.

        Once the close handshake is successful the socket will be closed.

        ``code`` may be a numeric status code, taken from the values
        defined in `RFC 6455 section 7.4.1
        <https://tools.ietf.org/html/rfc6455#section-7.4.1>`_.
        ``reason`` may be a textual message about why the connection is
        closing.  These values are made available to the client, but are
        not otherwise interpreted by the websocket protocol.

        .. versionchanged:: 4.0

           Added the ``code`` and ``reason`` arguments.
        """
        if self.ws_connection:
            self.ws_connection.close(code, reason)
            self.ws_connection = None

    def check_origin(self, origin):
        """Override to enable support for allowing alternate origins.

        The ``origin`` argument is the value of the ``Origin`` HTTP
        header, the url responsible for initiating this request.  This
        method is not called for clients that do not send this header;
        such requests are always allowed (because all browsers that
        implement WebSockets support this header, and non-browser
        clients do not have the same cross-site security concerns).

        Should return True to accept the request or False to reject it.
        By default, rejects all requests with an origin on a host other
        than this one.

        This is a security protection against cross site scripting attacks on
        browsers, since WebSockets are allowed to bypass the usual same-origin
        policies and don't use CORS headers.

        To accept all cross-origin traffic (which was the default prior to
        Tornado 4.0), simply override this method to always return true::

            def check_origin(self, origin):
                return True

        To allow connections from any subdomain of your site, you might
        do something like::

            def check_origin(self, origin):
                parsed_origin = urllib.parse.urlparse(origin)
                return parsed_origin.netloc.endswith(".mydomain.com")

        .. versionadded:: 4.0
        """
        parsed_origin = urlparse(origin)
        origin = parsed_origin.netloc
        origin = origin.lower()

        host = self.request.headers.get("Host")

        # Check to see that origin matches host directly, including ports
        return origin == host

    def set_nodelay(self, value):
        """Set the no-delay flag for this stream.

        By default, small messages may be delayed and/or combined to minimize
        the number of packets sent.  This can sometimes cause 200-500ms delays
        due to the interaction between Nagle's algorithm and TCP delayed
        ACKs.  To reduce this delay (at the expense of possibly increasing
        bandwidth usage), call ``self.set_nodelay(True)`` once the websocket
        connection is established.

        See `.BaseIOStream.set_nodelay` for additional details.

        .. versionadded:: 3.1
        """
        self.stream.set_nodelay(value)

    def on_connection_close(self):
        if self.ws_connection:
            self.ws_connection.on_connection_close()
            self.ws_connection = None
        if not self._on_close_called:
            self._on_close_called = True
            self.on_close()

    def send_error(self, *args, **kwargs):
        if self.stream is None:
            super(WebSocketHandler, self).send_error(*args, **kwargs)
        else:
            # If we get an uncaught exception during the handshake,
            # we have no choice but to abruptly close the connection.
            # TODO: for uncaught exceptions after the handshake,
            # we can close the connection more gracefully.
            self.stream.close()

    def get_websocket_protocol(self):
        websocket_version = self.request.headers.get("Sec-WebSocket-Version")
        if websocket_version in ("7", "8", "13"):
            return WebSocketProtocol13(
                self, compression_options=self.get_compression_options())


def _wrap_method(method):
    def _disallow_for_websocket(self, *args, **kwargs):
        if self.stream is None:
            method(self, *args, **kwargs)
        else:
            raise RuntimeError("Method not supported for Web Sockets")
    return _disallow_for_websocket
for method in ["write", "redirect", "set_header", "set_cookie",
               "set_status", "flush", "finish"]:
    setattr(WebSocketHandler, method,
            _wrap_method(getattr(WebSocketHandler, method)))


class WebSocketProtocol(object):
    """Base class for WebSocket protocol versions.
    """
    def __init__(self, handler):
        self.handler = handler
        self.request = handler.request
        self.stream = handler.stream
        self.client_terminated = False
        self.server_terminated = False

    def _run_callback(self, callback, *args, **kwargs):
        """Runs the given callback with exception handling.

        On error, aborts the websocket connection and returns False.
        """
        try:
            callback(*args, **kwargs)
        except Exception:
            app_log.error("Uncaught exception in %s",
                          self.request.path, exc_info=True)
            self._abort()

    def on_connection_close(self):
        self._abort()

    def _abort(self):
        """Instantly aborts the WebSocket connection by closing the socket"""
        self.client_terminated = True
        self.server_terminated = True
        self.stream.close()  # forcibly tear down the connection
        self.close()  # let the subclass cleanup


class _PerMessageDeflateCompressor(object):
    def __init__(self, persistent, max_wbits):
        if max_wbits is None:
            max_wbits = zlib.MAX_WBITS
        # There is no symbolic constant for the minimum wbits value.
        if not (8 <= max_wbits <= zlib.MAX_WBITS):
            raise ValueError("Invalid max_wbits value %r; allowed range 8-%d",
                             max_wbits, zlib.MAX_WBITS)
        self._max_wbits = max_wbits
        if persistent:
            self._compressor = self._create_compressor()
        else:
            self._compressor = None

    def _create_compressor(self):
        return zlib.compressobj(-1, zlib.DEFLATED, -self._max_wbits)

    def compress(self, data):
        compressor = self._compressor or self._create_compressor()
        data = (compressor.compress(data) +
                compressor.flush(zlib.Z_SYNC_FLUSH))
        assert data.endswith(b'\x00\x00\xff\xff')
        return data[:-4]


class _PerMessageDeflateDecompressor(object):
    def __init__(self, persistent, max_wbits):
        if max_wbits is None:
            max_wbits = zlib.MAX_WBITS
        if not (8 <= max_wbits <= zlib.MAX_WBITS):
            raise ValueError("Invalid max_wbits value %r; allowed range 8-%d",
                             max_wbits, zlib.MAX_WBITS)
        self._max_wbits = max_wbits
        if persistent:
            self._decompressor = self._create_decompressor()
        else:
            self._decompressor = None

    def _create_decompressor(self):
        return zlib.decompressobj(-self._max_wbits)

    def decompress(self, data):
        decompressor = self._decompressor or self._create_decompressor()
        return decompressor.decompress(data + b'\x00\x00\xff\xff')


class WebSocketProtocol13(WebSocketProtocol):
    """Implementation of the WebSocket protocol from RFC 6455.

    This class supports versions 7 and 8 of the protocol in addition to the
    final version 13.
    """
    # Bit masks for the first byte of a frame.
    FIN = 0x80
    RSV1 = 0x40
    RSV2 = 0x20
    RSV3 = 0x10
    RSV_MASK = RSV1 | RSV2 | RSV3
    OPCODE_MASK = 0x0f

    def __init__(self, handler, mask_outgoing=False,
                 compression_options=None):
        WebSocketProtocol.__init__(self, handler)
        self.mask_outgoing = mask_outgoing
        self._final_frame = False
        self._frame_opcode = None
        self._masked_frame = None
        self._frame_mask = None
        self._frame_length = None
        self._fragmented_message_buffer = None
        self._fragmented_message_opcode = None
        self._waiting = None
        self._compression_options = compression_options
        self._decompressor = None
        self._compressor = None
        self._frame_compressed = None
        # The total uncompressed size of all messages received or sent.
        # Unicode messages are encoded to utf8.
        # Only for testing; subject to change.
        self._message_bytes_in = 0
        self._message_bytes_out = 0
        # The total size of all packets received or sent.  Includes
        # the effect of compression, frame overhead, and control frames.
        self._wire_bytes_in = 0
        self._wire_bytes_out = 0

    def accept_connection(self):
        try:
            self._handle_websocket_headers()
            self._accept_connection()
        except ValueError:
            gen_log.debug("Malformed WebSocket request received",
                          exc_info=True)
            self._abort()
            return

    def _handle_websocket_headers(self):
        """Verifies all invariant- and required headers

        If a header is missing or have an incorrect value ValueError will be
        raised
        """
        fields = ("Host", "Sec-Websocket-Key", "Sec-Websocket-Version")
        if not all(map(lambda f: self.request.headers.get(f), fields)):
            raise ValueError("Missing/Invalid WebSocket headers")

    @staticmethod
    def compute_accept_value(key):
        """Computes the value for the Sec-WebSocket-Accept header,
        given the value for Sec-WebSocket-Key.
        """
        sha1 = hashlib.sha1()
        sha1.update(utf8(key))
        sha1.update(b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")  # Magic value
        return native_str(base64.b64encode(sha1.digest()))

    def _challenge_response(self):
        return WebSocketProtocol13.compute_accept_value(
            self.request.headers.get("Sec-Websocket-Key"))

    def _accept_connection(self):
        subprotocol_header = ''
        subprotocols = self.request.headers.get("Sec-WebSocket-Protocol", '')
        subprotocols = [s.strip() for s in subprotocols.split(',')]
        if subprotocols:
            selected = self.handler.select_subprotocol(subprotocols)
            if selected:
                assert selected in subprotocols
                subprotocol_header = ("Sec-WebSocket-Protocol: %s\r\n"
                                      % selected)

        extension_header = ''
        extensions = self._parse_extensions_header(self.request.headers)
        for ext in extensions:
            if (ext[0] == 'permessage-deflate' and
                    self._compression_options is not None):
                # TODO: negotiate parameters if compression_options
                # specifies limits.
                self._create_compressors('server', ext[1])
                if ('client_max_window_bits' in ext[1] and
                        ext[1]['client_max_window_bits'] is None):
                    # Don't echo an offered client_max_window_bits
                    # parameter with no value.
                    del ext[1]['client_max_window_bits']
                extension_header = ('Sec-WebSocket-Extensions: %s\r\n' %
                                    httputil._encode_header(
                                        'permessage-deflate', ext[1]))
                break

        if self.stream.closed():
            self._abort()
            return
        self.stream.write(tornado.escape.utf8(
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: %s\r\n"
            "%s%s"
            "\r\n" % (self._challenge_response(),
                      subprotocol_header, extension_header)))

        self._run_callback(self.handler.open, *self.handler.open_args,
                           **self.handler.open_kwargs)
        self._receive_frame()

    def _parse_extensions_header(self, headers):
        extensions = headers.get("Sec-WebSocket-Extensions", '')
        if extensions:
            return [httputil._parse_header(e.strip())
                    for e in extensions.split(',')]
        return []

    def _process_server_headers(self, key, headers):
        """Process the headers sent by the server to this client connection.

        'key' is the websocket handshake challenge/response key.
        """
        assert headers['Upgrade'].lower() == 'websocket'
        assert headers['Connection'].lower() == 'upgrade'
        accept = self.compute_accept_value(key)
        assert headers['Sec-Websocket-Accept'] == accept

        extensions = self._parse_extensions_header(headers)
        for ext in extensions:
            if (ext[0] == 'permessage-deflate' and
                    self._compression_options is not None):
                self._create_compressors('client', ext[1])
            else:
                raise ValueError("unsupported extension %r", ext)

    def _get_compressor_options(self, side, agreed_parameters):
        """Converts a websocket agreed_parameters set to keyword arguments
        for our compressor objects.
        """
        options = dict(
            persistent=(side + '_no_context_takeover') not in agreed_parameters)
        wbits_header = agreed_parameters.get(side + '_max_window_bits', None)
        if wbits_header is None:
            options['max_wbits'] = zlib.MAX_WBITS
        else:
            options['max_wbits'] = int(wbits_header)
        return options

    def _create_compressors(self, side, agreed_parameters):
        # TODO: handle invalid parameters gracefully
        allowed_keys = set(['server_no_context_takeover',
                            'client_no_context_takeover',
                            'server_max_window_bits',
                            'client_max_window_bits'])
        for key in agreed_parameters:
            if key not in allowed_keys:
                raise ValueError("unsupported compression parameter %r" % key)
        other_side = 'client' if (side == 'server') else 'server'
        self._compressor = _PerMessageDeflateCompressor(
            **self._get_compressor_options(side, agreed_parameters))
        self._decompressor = _PerMessageDeflateDecompressor(
            **self._get_compressor_options(other_side, agreed_parameters))

    def _write_frame(self, fin, opcode, data, flags=0):
        if fin:
            finbit = self.FIN
        else:
            finbit = 0
        frame = struct.pack("B", finbit | opcode | flags)
        l = len(data)
        if self.mask_outgoing:
            mask_bit = 0x80
        else:
            mask_bit = 0
        if l < 126:
            frame += struct.pack("B", l | mask_bit)
        elif l <= 0xFFFF:
            frame += struct.pack("!BH", 126 | mask_bit, l)
        else:
            frame += struct.pack("!BQ", 127 | mask_bit, l)
        if self.mask_outgoing:
            mask = os.urandom(4)
            data = mask + _websocket_mask(mask, data)
        frame += data
        self._wire_bytes_out += len(frame)
        try:
            self.stream.write(frame)
        except StreamClosedError:
            self._abort()

    def write_message(self, message, binary=False):
        """Sends the given message to the client of this Web Socket."""
        if binary:
            opcode = 0x2
        else:
            opcode = 0x1
        message = tornado.escape.utf8(message)
        assert isinstance(message, bytes)
        self._message_bytes_out += len(message)
        flags = 0
        if self._compressor:
            message = self._compressor.compress(message)
            flags |= self.RSV1
        self._write_frame(True, opcode, message, flags=flags)

    def write_ping(self, data):
        """Send ping frame."""
        assert isinstance(data, bytes)
        self._write_frame(True, 0x9, data)

    def _receive_frame(self):
        try:
            self.stream.read_bytes(2, self._on_frame_start)
        except StreamClosedError:
            self._abort()

    def _on_frame_start(self, data):
        self._wire_bytes_in += len(data)
        header, payloadlen = struct.unpack("BB", data)
        self._final_frame = header & self.FIN
        reserved_bits = header & self.RSV_MASK
        self._frame_opcode = header & self.OPCODE_MASK
        self._frame_opcode_is_control = self._frame_opcode & 0x8
        if self._decompressor is not None:
            self._frame_compressed = bool(reserved_bits & self.RSV1)
            reserved_bits &= ~self.RSV1
        if reserved_bits:
            # client is using as-yet-undefined extensions; abort
            self._abort()
            return
        self._masked_frame = bool(payloadlen & 0x80)
        payloadlen = payloadlen & 0x7f
        if self._frame_opcode_is_control and payloadlen >= 126:
            # control frames must have payload < 126
            self._abort()
            return
        try:
            if payloadlen < 126:
                self._frame_length = payloadlen
                if self._masked_frame:
                    self.stream.read_bytes(4, self._on_masking_key)
                else:
                    self.stream.read_bytes(self._frame_length,
                                           self._on_frame_data)
            elif payloadlen == 126:
                self.stream.read_bytes(2, self._on_frame_length_16)
            elif payloadlen == 127:
                self.stream.read_bytes(8, self._on_frame_length_64)
        except StreamClosedError:
            self._abort()

    def _on_frame_length_16(self, data):
        self._wire_bytes_in += len(data)
        self._frame_length = struct.unpack("!H", data)[0]
        try:
            if self._masked_frame:
                self.stream.read_bytes(4, self._on_masking_key)
            else:
                self.stream.read_bytes(self._frame_length, self._on_frame_data)
        except StreamClosedError:
            self._abort()

    def _on_frame_length_64(self, data):
        self._wire_bytes_in += len(data)
        self._frame_length = struct.unpack("!Q", data)[0]
        try:
            if self._masked_frame:
                self.stream.read_bytes(4, self._on_masking_key)
            else:
                self.stream.read_bytes(self._frame_length, self._on_frame_data)
        except StreamClosedError:
            self._abort()

    def _on_masking_key(self, data):
        self._wire_bytes_in += len(data)
        self._frame_mask = data
        try:
            self.stream.read_bytes(self._frame_length,
                                   self._on_masked_frame_data)
        except StreamClosedError:
            self._abort()

    def _on_masked_frame_data(self, data):
        # Don't touch _wire_bytes_in; we'll do it in _on_frame_data.
        self._on_frame_data(_websocket_mask(self._frame_mask, data))

    def _on_frame_data(self, data):
        self._wire_bytes_in += len(data)
        if self._frame_opcode_is_control:
            # control frames may be interleaved with a series of fragmented
            # data frames, so control frames must not interact with
            # self._fragmented_*
            if not self._final_frame:
                # control frames must not be fragmented
                self._abort()
                return
            opcode = self._frame_opcode
        elif self._frame_opcode == 0:  # continuation frame
            if self._fragmented_message_buffer is None:
                # nothing to continue
                self._abort()
                return
            self._fragmented_message_buffer += data
            if self._final_frame:
                opcode = self._fragmented_message_opcode
                data = self._fragmented_message_buffer
                self._fragmented_message_buffer = None
        else:  # start of new data message
            if self._fragmented_message_buffer is not None:
                # can't start new message until the old one is finished
                self._abort()
                return
            if self._final_frame:
                opcode = self._frame_opcode
            else:
                self._fragmented_message_opcode = self._frame_opcode
                self._fragmented_message_buffer = data

        if self._final_frame:
            self._handle_message(opcode, data)

        if not self.client_terminated:
            self._receive_frame()

    def _handle_message(self, opcode, data):
        if self.client_terminated:
            return

        if self._frame_compressed:
            data = self._decompressor.decompress(data)

        if opcode == 0x1:
            # UTF-8 data
            self._message_bytes_in += len(data)
            try:
                decoded = data.decode("utf-8")
            except UnicodeDecodeError:
                self._abort()
                return
            self._run_callback(self.handler.on_message, decoded)
        elif opcode == 0x2:
            # Binary data
            self._message_bytes_in += len(data)
            self._run_callback(self.handler.on_message, data)
        elif opcode == 0x8:
            # Close
            self.client_terminated = True
            if len(data) >= 2:
                self.handler.close_code = struct.unpack('>H', data[:2])[0]
            if len(data) > 2:
                self.handler.close_reason = to_unicode(data[2:])
            # Echo the received close code, if any (RFC 6455 section 5.5.1).
            self.close(self.handler.close_code)
        elif opcode == 0x9:
            # Ping
            self._write_frame(True, 0xA, data)
        elif opcode == 0xA:
            # Pong
            self._run_callback(self.handler.on_pong, data)
        else:
            self._abort()

    def close(self, code=None, reason=None):
        """Closes the WebSocket connection."""
        if not self.server_terminated:
            if not self.stream.closed():
                if code is None and reason is not None:
                    code = 1000  # "normal closure" status code
                if code is None:
                    close_data = b''
                else:
                    close_data = struct.pack('>H', code)
                if reason is not None:
                    close_data += utf8(reason)
                self._write_frame(True, 0x8, close_data)
            self.server_terminated = True
        if self.client_terminated:
            if self._waiting is not None:
                self.stream.io_loop.remove_timeout(self._waiting)
                self._waiting = None
            self.stream.close()
        elif self._waiting is None:
            # Give the client a few seconds to complete a clean shutdown,
            # otherwise just close the connection.
            self._waiting = self.stream.io_loop.add_timeout(
                self.stream.io_loop.time() + 5, self._abort)


class WebSocketClientConnection(simple_httpclient._HTTPConnection):
    """WebSocket client connection.

    This class should not be instantiated directly; use the
    `websocket_connect` function instead.
    """
    def __init__(self, io_loop, request, on_message_callback=None,
                 compression_options=None):
        self.compression_options = compression_options
        self.connect_future = TracebackFuture()
        self.protocol = None
        self.read_future = None
        self.read_queue = collections.deque()
        self.key = base64.b64encode(os.urandom(16))
        self._on_message_callback = on_message_callback
        self.close_code = self.close_reason = None

        scheme, sep, rest = request.url.partition(':')
        scheme = {'ws': 'http', 'wss': 'https'}[scheme]
        request.url = scheme + sep + rest
        request.headers.update({
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'Sec-WebSocket-Key': self.key,
            'Sec-WebSocket-Version': '13',
        })
        if self.compression_options is not None:
            # Always offer to let the server set our max_wbits (and even though
            # we don't offer it, we will accept a client_no_context_takeover
            # from the server).
            # TODO: set server parameters for deflate extension
            # if requested in self.compression_options.
            request.headers['Sec-WebSocket-Extensions'] = (
                'permessage-deflate; client_max_window_bits')

        self.tcp_client = TCPClient(io_loop=io_loop)
        super(WebSocketClientConnection, self).__init__(
            io_loop, None, request, lambda: None, self._on_http_response,
            104857600, self.tcp_client, 65536, 104857600)

    def close(self, code=None, reason=None):
        """Closes the websocket connection.

        ``code`` and ``reason`` are documented under
        `WebSocketHandler.close`.

        .. versionadded:: 3.2

        .. versionchanged:: 4.0

           Added the ``code`` and ``reason`` arguments.
        """
        if self.protocol is not None:
            self.protocol.close(code, reason)
            self.protocol = None

    def on_connection_close(self):
        if not self.connect_future.done():
            self.connect_future.set_exception(StreamClosedError())
        self.on_message(None)
        self.tcp_client.close()
        super(WebSocketClientConnection, self).on_connection_close()

    def _on_http_response(self, response):
        if not self.connect_future.done():
            if response.error:
                self.connect_future.set_exception(response.error)
            else:
                self.connect_future.set_exception(WebSocketError(
                    "Non-websocket response"))

    def headers_received(self, start_line, headers):
        if start_line.code != 101:
            return super(WebSocketClientConnection, self).headers_received(
                start_line, headers)

        self.headers = headers
        self.protocol = self.get_websocket_protocol()
        self.protocol._process_server_headers(self.key, self.headers)
        self.protocol._receive_frame()

        if self._timeout is not None:
            self.io_loop.remove_timeout(self._timeout)
            self._timeout = None

        self.stream = self.connection.detach()
        self.stream.set_close_callback(self.on_connection_close)
        # Once we've taken over the connection, clear the final callback
        # we set on the http request.  This deactivates the error handling
        # in simple_httpclient that would otherwise interfere with our
        # ability to see exceptions.
        self.final_callback = None

        self.connect_future.set_result(self)

    def write_message(self, message, binary=False):
        """Sends a message to the WebSocket server."""
        self.protocol.write_message(message, binary)

    def read_message(self, callback=None):
        """Reads a message from the WebSocket server.

        If on_message_callback was specified at WebSocket
        initialization, this function will never return messages

        Returns a future whose result is the message, or None
        if the connection is closed.  If a callback argument
        is given it will be called with the future when it is
        ready.
        """
        assert self.read_future is None
        future = TracebackFuture()
        if self.read_queue:
            future.set_result(self.read_queue.popleft())
        else:
            self.read_future = future
        if callback is not None:
            self.io_loop.add_future(future, callback)
        return future

    def on_message(self, message):
        if self._on_message_callback:
            self._on_message_callback(message)
        elif self.read_future is not None:
            self.read_future.set_result(message)
            self.read_future = None
        else:
            self.read_queue.append(message)

    def on_pong(self, data):
        pass

    def get_websocket_protocol(self):
        return WebSocketProtocol13(self, mask_outgoing=True,
                                   compression_options=self.compression_options)


def websocket_connect(url, io_loop=None, callback=None, connect_timeout=None,
                      on_message_callback=None, compression_options=None):
    """Client-side websocket support.

    Takes a url and returns a Future whose result is a
    `WebSocketClientConnection`.

    ``compression_options`` is interpreted in the same way as the
    return value of `.WebSocketHandler.get_compression_options`.

    The connection supports two styles of operation. In the coroutine
    style, the application typically calls
    `~.WebSocketClientConnection.read_message` in a loop::

        conn = yield websocket_connection(loop)
        while True:
            msg = yield conn.read_message()
            if msg is None: break
            # Do something with msg

    In the callback style, pass an ``on_message_callback`` to
    ``websocket_connect``. In both styles, a message of ``None``
    indicates that the connection has been closed.

    .. versionchanged:: 3.2
       Also accepts ``HTTPRequest`` objects in place of urls.

    .. versionchanged:: 4.1
       Added ``compression_options`` and ``on_message_callback``.
       The ``io_loop`` argument is deprecated.
    """
    if io_loop is None:
        io_loop = IOLoop.current()
    if isinstance(url, httpclient.HTTPRequest):
        assert connect_timeout is None
        request = url
        # Copy and convert the headers dict/object (see comments in
        # AsyncHTTPClient.fetch)
        request.headers = httputil.HTTPHeaders(request.headers)
    else:
        request = httpclient.HTTPRequest(url, connect_timeout=connect_timeout)
    request = httpclient._RequestProxy(
        request, httpclient.HTTPRequest._DEFAULTS)
    conn = WebSocketClientConnection(io_loop, request,
                                     on_message_callback=on_message_callback,
                                     compression_options=compression_options)
    if callback is not None:
        io_loop.add_future(conn.connect_future, callback)
    return conn.connect_future
