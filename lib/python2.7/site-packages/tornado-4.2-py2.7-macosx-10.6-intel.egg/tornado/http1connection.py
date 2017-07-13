#!/usr/bin/env python
#
# Copyright 2014 Facebook
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

"""Client and server implementations of HTTP/1.x.

.. versionadded:: 4.0
"""

from __future__ import absolute_import, division, print_function, with_statement

import re

from tornado.concurrent import Future
from tornado.escape import native_str, utf8
from tornado import gen
from tornado import httputil
from tornado import iostream
from tornado.log import gen_log, app_log
from tornado import stack_context
from tornado.util import GzipDecompressor


class _QuietException(Exception):
    def __init__(self):
        pass


class _ExceptionLoggingContext(object):
    """Used with the ``with`` statement when calling delegate methods to
    log any exceptions with the given logger.  Any exceptions caught are
    converted to _QuietException
    """
    def __init__(self, logger):
        self.logger = logger

    def __enter__(self):
        pass

    def __exit__(self, typ, value, tb):
        if value is not None:
            self.logger.error("Uncaught exception", exc_info=(typ, value, tb))
            raise _QuietException


class HTTP1ConnectionParameters(object):
    """Parameters for `.HTTP1Connection` and `.HTTP1ServerConnection`.
    """
    def __init__(self, no_keep_alive=False, chunk_size=None,
                 max_header_size=None, header_timeout=None, max_body_size=None,
                 body_timeout=None, decompress=False):
        """
        :arg bool no_keep_alive: If true, always close the connection after
            one request.
        :arg int chunk_size: how much data to read into memory at once
        :arg int max_header_size:  maximum amount of data for HTTP headers
        :arg float header_timeout: how long to wait for all headers (seconds)
        :arg int max_body_size: maximum amount of data for body
        :arg float body_timeout: how long to wait while reading body (seconds)
        :arg bool decompress: if true, decode incoming
            ``Content-Encoding: gzip``
        """
        self.no_keep_alive = no_keep_alive
        self.chunk_size = chunk_size or 65536
        self.max_header_size = max_header_size or 65536
        self.header_timeout = header_timeout
        self.max_body_size = max_body_size
        self.body_timeout = body_timeout
        self.decompress = decompress


class HTTP1Connection(httputil.HTTPConnection):
    """Implements the HTTP/1.x protocol.

    This class can be on its own for clients, or via `HTTP1ServerConnection`
    for servers.
    """
    def __init__(self, stream, is_client, params=None, context=None):
        """
        :arg stream: an `.IOStream`
        :arg bool is_client: client or server
        :arg params: a `.HTTP1ConnectionParameters` instance or ``None``
        :arg context: an opaque application-defined object that can be accessed
            as ``connection.context``.
        """
        self.is_client = is_client
        self.stream = stream
        if params is None:
            params = HTTP1ConnectionParameters()
        self.params = params
        self.context = context
        self.no_keep_alive = params.no_keep_alive
        # The body limits can be altered by the delegate, so save them
        # here instead of just referencing self.params later.
        self._max_body_size = (self.params.max_body_size or
                               self.stream.max_buffer_size)
        self._body_timeout = self.params.body_timeout
        # _write_finished is set to True when finish() has been called,
        # i.e. there will be no more data sent.  Data may still be in the
        # stream's write buffer.
        self._write_finished = False
        # True when we have read the entire incoming body.
        self._read_finished = False
        # _finish_future resolves when all data has been written and flushed
        # to the IOStream.
        self._finish_future = Future()
        # If true, the connection should be closed after this request
        # (after the response has been written in the server side,
        # and after it has been read in the client)
        self._disconnect_on_finish = False
        self._clear_callbacks()
        # Save the start lines after we read or write them; they
        # affect later processing (e.g. 304 responses and HEAD methods
        # have content-length but no bodies)
        self._request_start_line = None
        self._response_start_line = None
        self._request_headers = None
        # True if we are writing output with chunked encoding.
        self._chunking_output = None
        # While reading a body with a content-length, this is the
        # amount left to read.
        self._expected_content_remaining = None
        # A Future for our outgoing writes, returned by IOStream.write.
        self._pending_write = None

    def read_response(self, delegate):
        """Read a single HTTP response.

        Typical client-mode usage is to write a request using `write_headers`,
        `write`, and `finish`, and then call ``read_response``.

        :arg delegate: a `.HTTPMessageDelegate`

        Returns a `.Future` that resolves to None after the full response has
        been read.
        """
        if self.params.decompress:
            delegate = _GzipMessageDelegate(delegate, self.params.chunk_size)
        return self._read_message(delegate)

    @gen.coroutine
    def _read_message(self, delegate):
        need_delegate_close = False
        try:
            header_future = self.stream.read_until_regex(
                b"\r?\n\r?\n",
                max_bytes=self.params.max_header_size)
            if self.params.header_timeout is None:
                header_data = yield header_future
            else:
                try:
                    header_data = yield gen.with_timeout(
                        self.stream.io_loop.time() + self.params.header_timeout,
                        header_future,
                        io_loop=self.stream.io_loop,
                        quiet_exceptions=iostream.StreamClosedError)
                except gen.TimeoutError:
                    self.close()
                    raise gen.Return(False)
            start_line, headers = self._parse_headers(header_data)
            if self.is_client:
                start_line = httputil.parse_response_start_line(start_line)
                self._response_start_line = start_line
            else:
                start_line = httputil.parse_request_start_line(start_line)
                self._request_start_line = start_line
                self._request_headers = headers

            self._disconnect_on_finish = not self._can_keep_alive(
                start_line, headers)
            need_delegate_close = True
            with _ExceptionLoggingContext(app_log):
                header_future = delegate.headers_received(start_line, headers)
                if header_future is not None:
                    yield header_future
            if self.stream is None:
                # We've been detached.
                need_delegate_close = False
                raise gen.Return(False)
            skip_body = False
            if self.is_client:
                if (self._request_start_line is not None and
                        self._request_start_line.method == 'HEAD'):
                    skip_body = True
                code = start_line.code
                if code == 304:
                    # 304 responses may include the content-length header
                    # but do not actually have a body.
                    # http://tools.ietf.org/html/rfc7230#section-3.3
                    skip_body = True
                if code >= 100 and code < 200:
                    # 1xx responses should never indicate the presence of
                    # a body.
                    if ('Content-Length' in headers or
                            'Transfer-Encoding' in headers):
                        raise httputil.HTTPInputError(
                            "Response code %d cannot have body" % code)
                    # TODO: client delegates will get headers_received twice
                    # in the case of a 100-continue.  Document or change?
                    yield self._read_message(delegate)
            else:
                if (headers.get("Expect") == "100-continue" and
                        not self._write_finished):
                    self.stream.write(b"HTTP/1.1 100 (Continue)\r\n\r\n")
            if not skip_body:
                body_future = self._read_body(
                    start_line.code if self.is_client else 0, headers, delegate)
                if body_future is not None:
                    if self._body_timeout is None:
                        yield body_future
                    else:
                        try:
                            yield gen.with_timeout(
                                self.stream.io_loop.time() + self._body_timeout,
                                body_future, self.stream.io_loop,
                                quiet_exceptions=iostream.StreamClosedError)
                        except gen.TimeoutError:
                            gen_log.info("Timeout reading body from %s",
                                         self.context)
                            self.stream.close()
                            raise gen.Return(False)
            self._read_finished = True
            if not self._write_finished or self.is_client:
                need_delegate_close = False
                with _ExceptionLoggingContext(app_log):
                    delegate.finish()
            # If we're waiting for the application to produce an asynchronous
            # response, and we're not detached, register a close callback
            # on the stream (we didn't need one while we were reading)
            if (not self._finish_future.done() and
                    self.stream is not None and
                    not self.stream.closed()):
                self.stream.set_close_callback(self._on_connection_close)
                yield self._finish_future
            if self.is_client and self._disconnect_on_finish:
                self.close()
            if self.stream is None:
                raise gen.Return(False)
        except httputil.HTTPInputError as e:
            gen_log.info("Malformed HTTP message from %s: %s",
                         self.context, e)
            self.close()
            raise gen.Return(False)
        finally:
            if need_delegate_close:
                with _ExceptionLoggingContext(app_log):
                    delegate.on_connection_close()
            self._clear_callbacks()
        raise gen.Return(True)

    def _clear_callbacks(self):
        """Clears the callback attributes.

        This allows the request handler to be garbage collected more
        quickly in CPython by breaking up reference cycles.
        """
        self._write_callback = None
        self._write_future = None
        self._close_callback = None
        if self.stream is not None:
            self.stream.set_close_callback(None)

    def set_close_callback(self, callback):
        """Sets a callback that will be run when the connection is closed.

        .. deprecated:: 4.0
            Use `.HTTPMessageDelegate.on_connection_close` instead.
        """
        self._close_callback = stack_context.wrap(callback)

    def _on_connection_close(self):
        # Note that this callback is only registered on the IOStream
        # when we have finished reading the request and are waiting for
        # the application to produce its response.
        if self._close_callback is not None:
            callback = self._close_callback
            self._close_callback = None
            callback()
        if not self._finish_future.done():
            self._finish_future.set_result(None)
        self._clear_callbacks()

    def close(self):
        if self.stream is not None:
            self.stream.close()
        self._clear_callbacks()
        if not self._finish_future.done():
            self._finish_future.set_result(None)

    def detach(self):
        """Take control of the underlying stream.

        Returns the underlying `.IOStream` object and stops all further
        HTTP processing.  May only be called during
        `.HTTPMessageDelegate.headers_received`.  Intended for implementing
        protocols like websockets that tunnel over an HTTP handshake.
        """
        self._clear_callbacks()
        stream = self.stream
        self.stream = None
        if not self._finish_future.done():
            self._finish_future.set_result(None)
        return stream

    def set_body_timeout(self, timeout):
        """Sets the body timeout for a single request.

        Overrides the value from `.HTTP1ConnectionParameters`.
        """
        self._body_timeout = timeout

    def set_max_body_size(self, max_body_size):
        """Sets the body size limit for a single request.

        Overrides the value from `.HTTP1ConnectionParameters`.
        """
        self._max_body_size = max_body_size

    def write_headers(self, start_line, headers, chunk=None, callback=None):
        """Implements `.HTTPConnection.write_headers`."""
        lines = []
        if self.is_client:
            self._request_start_line = start_line
            lines.append(utf8('%s %s HTTP/1.1' % (start_line[0], start_line[1])))
            # Client requests with a non-empty body must have either a
            # Content-Length or a Transfer-Encoding.
            self._chunking_output = (
                start_line.method in ('POST', 'PUT', 'PATCH') and
                'Content-Length' not in headers and
                'Transfer-Encoding' not in headers)
        else:
            self._response_start_line = start_line
            lines.append(utf8('HTTP/1.1 %s %s' % (start_line[1], start_line[2])))
            self._chunking_output = (
                # TODO: should this use
                # self._request_start_line.version or
                # start_line.version?
                self._request_start_line.version == 'HTTP/1.1' and
                # 304 responses have no body (not even a zero-length body), and so
                # should not have either Content-Length or Transfer-Encoding.
                # headers.
                start_line.code != 304 and
                # No need to chunk the output if a Content-Length is specified.
                'Content-Length' not in headers and
                # Applications are discouraged from touching Transfer-Encoding,
                # but if they do, leave it alone.
                'Transfer-Encoding' not in headers)
            # If a 1.0 client asked for keep-alive, add the header.
            if (self._request_start_line.version == 'HTTP/1.0' and
                (self._request_headers.get('Connection', '').lower()
                 == 'keep-alive')):
                headers['Connection'] = 'Keep-Alive'
        if self._chunking_output:
            headers['Transfer-Encoding'] = 'chunked'
        if (not self.is_client and
            (self._request_start_line.method == 'HEAD' or
             start_line.code == 304)):
            self._expected_content_remaining = 0
        elif 'Content-Length' in headers:
            self._expected_content_remaining = int(headers['Content-Length'])
        else:
            self._expected_content_remaining = None
        lines.extend([utf8(n) + b": " + utf8(v) for n, v in headers.get_all()])
        for line in lines:
            if b'\n' in line:
                raise ValueError('Newline in header: ' + repr(line))
        future = None
        if self.stream.closed():
            future = self._write_future = Future()
            future.set_exception(iostream.StreamClosedError())
            future.exception()
        else:
            if callback is not None:
                self._write_callback = stack_context.wrap(callback)
            else:
                future = self._write_future = Future()
            data = b"\r\n".join(lines) + b"\r\n\r\n"
            if chunk:
                data += self._format_chunk(chunk)
            self._pending_write = self.stream.write(data)
            self._pending_write.add_done_callback(self._on_write_complete)
        return future

    def _format_chunk(self, chunk):
        if self._expected_content_remaining is not None:
            self._expected_content_remaining -= len(chunk)
            if self._expected_content_remaining < 0:
                # Close the stream now to stop further framing errors.
                self.stream.close()
                raise httputil.HTTPOutputError(
                    "Tried to write more data than Content-Length")
        if self._chunking_output and chunk:
            # Don't write out empty chunks because that means END-OF-STREAM
            # with chunked encoding
            return utf8("%x" % len(chunk)) + b"\r\n" + chunk + b"\r\n"
        else:
            return chunk

    def write(self, chunk, callback=None):
        """Implements `.HTTPConnection.write`.

        For backwards compatibility is is allowed but deprecated to
        skip `write_headers` and instead call `write()` with a
        pre-encoded header block.
        """
        future = None
        if self.stream.closed():
            future = self._write_future = Future()
            self._write_future.set_exception(iostream.StreamClosedError())
            self._write_future.exception()
        else:
            if callback is not None:
                self._write_callback = stack_context.wrap(callback)
            else:
                future = self._write_future = Future()
            self._pending_write = self.stream.write(self._format_chunk(chunk))
            self._pending_write.add_done_callback(self._on_write_complete)
        return future

    def finish(self):
        """Implements `.HTTPConnection.finish`."""
        if (self._expected_content_remaining is not None and
                self._expected_content_remaining != 0 and
                not self.stream.closed()):
            self.stream.close()
            raise httputil.HTTPOutputError(
                "Tried to write %d bytes less than Content-Length" %
                self._expected_content_remaining)
        if self._chunking_output:
            if not self.stream.closed():
                self._pending_write = self.stream.write(b"0\r\n\r\n")
                self._pending_write.add_done_callback(self._on_write_complete)
        self._write_finished = True
        # If the app finished the request while we're still reading,
        # divert any remaining data away from the delegate and
        # close the connection when we're done sending our response.
        # Closing the connection is the only way to avoid reading the
        # whole input body.
        if not self._read_finished:
            self._disconnect_on_finish = True
        # No more data is coming, so instruct TCP to send any remaining
        # data immediately instead of waiting for a full packet or ack.
        self.stream.set_nodelay(True)
        if self._pending_write is None:
            self._finish_request(None)
        else:
            self._pending_write.add_done_callback(self._finish_request)

    def _on_write_complete(self, future):
        exc = future.exception()
        if exc is not None and not isinstance(exc, iostream.StreamClosedError):
            future.result()
        if self._write_callback is not None:
            callback = self._write_callback
            self._write_callback = None
            self.stream.io_loop.add_callback(callback)
        if self._write_future is not None:
            future = self._write_future
            self._write_future = None
            future.set_result(None)

    def _can_keep_alive(self, start_line, headers):
        if self.params.no_keep_alive:
            return False
        connection_header = headers.get("Connection")
        if connection_header is not None:
            connection_header = connection_header.lower()
        if start_line.version == "HTTP/1.1":
            return connection_header != "close"
        elif ("Content-Length" in headers
              or headers.get("Transfer-Encoding", "").lower() == "chunked"
              or start_line.method in ("HEAD", "GET")):
            return connection_header == "keep-alive"
        return False

    def _finish_request(self, future):
        self._clear_callbacks()
        if not self.is_client and self._disconnect_on_finish:
            self.close()
            return
        # Turn Nagle's algorithm back on, leaving the stream in its
        # default state for the next request.
        self.stream.set_nodelay(False)
        if not self._finish_future.done():
            self._finish_future.set_result(None)

    def _parse_headers(self, data):
        # The lstrip removes newlines that some implementations sometimes
        # insert between messages of a reused connection.  Per RFC 7230,
        # we SHOULD ignore at least one empty line before the request.
        # http://tools.ietf.org/html/rfc7230#section-3.5
        data = native_str(data.decode('latin1')).lstrip("\r\n")
        # RFC 7230 section allows for both CRLF and bare LF.
        eol = data.find("\n")
        start_line = data[:eol].rstrip("\r")
        try:
            headers = httputil.HTTPHeaders.parse(data[eol:])
        except ValueError:
            # probably form split() if there was no ':' in the line
            raise httputil.HTTPInputError("Malformed HTTP headers: %r" %
                                          data[eol:100])
        return start_line, headers

    def _read_body(self, code, headers, delegate):
        if "Content-Length" in headers:
            if "," in headers["Content-Length"]:
                # Proxies sometimes cause Content-Length headers to get
                # duplicated.  If all the values are identical then we can
                # use them but if they differ it's an error.
                pieces = re.split(r',\s*', headers["Content-Length"])
                if any(i != pieces[0] for i in pieces):
                    raise httputil.HTTPInputError(
                        "Multiple unequal Content-Lengths: %r" %
                        headers["Content-Length"])
                headers["Content-Length"] = pieces[0]
            content_length = int(headers["Content-Length"])

            if content_length > self._max_body_size:
                raise httputil.HTTPInputError("Content-Length too long")
        else:
            content_length = None

        if code == 204:
            # This response code is not allowed to have a non-empty body,
            # and has an implicit length of zero instead of read-until-close.
            # http://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.3
            if ("Transfer-Encoding" in headers or
                    content_length not in (None, 0)):
                raise httputil.HTTPInputError(
                    "Response with code %d should not have body" % code)
            content_length = 0

        if content_length is not None:
            return self._read_fixed_body(content_length, delegate)
        if headers.get("Transfer-Encoding") == "chunked":
            return self._read_chunked_body(delegate)
        if self.is_client:
            return self._read_body_until_close(delegate)
        return None

    @gen.coroutine
    def _read_fixed_body(self, content_length, delegate):
        while content_length > 0:
            body = yield self.stream.read_bytes(
                min(self.params.chunk_size, content_length), partial=True)
            content_length -= len(body)
            if not self._write_finished or self.is_client:
                with _ExceptionLoggingContext(app_log):
                    yield gen.maybe_future(delegate.data_received(body))

    @gen.coroutine
    def _read_chunked_body(self, delegate):
        # TODO: "chunk extensions" http://tools.ietf.org/html/rfc2616#section-3.6.1
        total_size = 0
        while True:
            chunk_len = yield self.stream.read_until(b"\r\n", max_bytes=64)
            chunk_len = int(chunk_len.strip(), 16)
            if chunk_len == 0:
                return
            total_size += chunk_len
            if total_size > self._max_body_size:
                raise httputil.HTTPInputError("chunked body too large")
            bytes_to_read = chunk_len
            while bytes_to_read:
                chunk = yield self.stream.read_bytes(
                    min(bytes_to_read, self.params.chunk_size), partial=True)
                bytes_to_read -= len(chunk)
                if not self._write_finished or self.is_client:
                    with _ExceptionLoggingContext(app_log):
                        yield gen.maybe_future(delegate.data_received(chunk))
            # chunk ends with \r\n
            crlf = yield self.stream.read_bytes(2)
            assert crlf == b"\r\n"

    @gen.coroutine
    def _read_body_until_close(self, delegate):
        body = yield self.stream.read_until_close()
        if not self._write_finished or self.is_client:
            with _ExceptionLoggingContext(app_log):
                delegate.data_received(body)


class _GzipMessageDelegate(httputil.HTTPMessageDelegate):
    """Wraps an `HTTPMessageDelegate` to decode ``Content-Encoding: gzip``.
    """
    def __init__(self, delegate, chunk_size):
        self._delegate = delegate
        self._chunk_size = chunk_size
        self._decompressor = None

    def headers_received(self, start_line, headers):
        if headers.get("Content-Encoding") == "gzip":
            self._decompressor = GzipDecompressor()
            # Downstream delegates will only see uncompressed data,
            # so rename the content-encoding header.
            # (but note that curl_httpclient doesn't do this).
            headers.add("X-Consumed-Content-Encoding",
                        headers["Content-Encoding"])
            del headers["Content-Encoding"]
        return self._delegate.headers_received(start_line, headers)

    @gen.coroutine
    def data_received(self, chunk):
        if self._decompressor:
            compressed_data = chunk
            while compressed_data:
                decompressed = self._decompressor.decompress(
                    compressed_data, self._chunk_size)
                if decompressed:
                    yield gen.maybe_future(
                        self._delegate.data_received(decompressed))
                compressed_data = self._decompressor.unconsumed_tail
        else:
            yield gen.maybe_future(self._delegate.data_received(chunk))

    def finish(self):
        if self._decompressor is not None:
            tail = self._decompressor.flush()
            if tail:
                # I believe the tail will always be empty (i.e.
                # decompress will return all it can).  The purpose
                # of the flush call is to detect errors such
                # as truncated input.  But in case it ever returns
                # anything, treat it as an extra chunk
                self._delegate.data_received(tail)
        return self._delegate.finish()

    def on_connection_close(self):
        return self._delegate.on_connection_close()


class HTTP1ServerConnection(object):
    """An HTTP/1.x server."""
    def __init__(self, stream, params=None, context=None):
        """
        :arg stream: an `.IOStream`
        :arg params: a `.HTTP1ConnectionParameters` or None
        :arg context: an opaque application-defined object that is accessible
            as ``connection.context``
        """
        self.stream = stream
        if params is None:
            params = HTTP1ConnectionParameters()
        self.params = params
        self.context = context
        self._serving_future = None

    @gen.coroutine
    def close(self):
        """Closes the connection.

        Returns a `.Future` that resolves after the serving loop has exited.
        """
        self.stream.close()
        # Block until the serving loop is done, but ignore any exceptions
        # (start_serving is already responsible for logging them).
        try:
            yield self._serving_future
        except Exception:
            pass

    def start_serving(self, delegate):
        """Starts serving requests on this connection.

        :arg delegate: a `.HTTPServerConnectionDelegate`
        """
        assert isinstance(delegate, httputil.HTTPServerConnectionDelegate)
        self._serving_future = self._server_request_loop(delegate)
        # Register the future on the IOLoop so its errors get logged.
        self.stream.io_loop.add_future(self._serving_future,
                                       lambda f: f.result())

    @gen.coroutine
    def _server_request_loop(self, delegate):
        try:
            while True:
                conn = HTTP1Connection(self.stream, False,
                                       self.params, self.context)
                request_delegate = delegate.start_request(self, conn)
                try:
                    ret = yield conn.read_response(request_delegate)
                except (iostream.StreamClosedError,
                        iostream.UnsatisfiableReadError):
                    return
                except _QuietException:
                    # This exception was already logged.
                    conn.close()
                    return
                except Exception:
                    gen_log.error("Uncaught exception", exc_info=True)
                    conn.close()
                    return
                if not ret:
                    return
                yield gen.moment
        finally:
            delegate.on_close(self)
