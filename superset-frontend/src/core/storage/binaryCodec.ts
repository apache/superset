/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/** Convert bytes to a base64 string, for transport over the JSON REST API. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function isBinaryValue(value: unknown): value is Uint8Array | ArrayBuffer {
  return value instanceof Uint8Array || value instanceof ArrayBuffer;
}

/**
 * Infer which codec to use for `value` when the caller didn't specify one.
 *
 * "json" names the serialization format applied to encode the value for
 * storage/transport -- it is not a claim about the value's shape. Per
 * RFC 8259, a JSON text may be any JSON value (object, array, string,
 * number, boolean, or null), so scalars like `1` or `"foo"` are encoded
 * with the "json" codec too, alongside objects and arrays.
 *
 * Binary values (Uint8Array/ArrayBuffer) are the one case JSON cannot
 * represent, so they're stored with the "binary" codec instead.
 */
function inferDefaultCodec(value: unknown): 'json' | 'binary' {
  return isBinaryValue(value) ? 'binary' : 'json';
}

/**
 * Resolve the codec and request-body value for a `set()` call.
 *
 * If the caller explicitly set `options.codec`, it is always respected
 * as-is and `value` is passed through untouched -- the caller is
 * responsible for encoding it correctly (e.g. base64-encoding it
 * themselves before calling `set()`, if the chosen codec is "binary").
 * Auto base64-encoding only happens when no codec was specified and
 * `value` is binary.
 *
 * base64 itself is not a codec -- it's how a "binary" codec's raw bytes
 * are carried inside a JSON request body, since JSON has no byte type.
 */
export function resolveSetPayload<T>(
  value: T,
  explicitCodec: string | undefined,
): { value: unknown; codec: string } {
  if (explicitCodec !== undefined) {
    return { value, codec: explicitCodec };
  }
  if (isBinaryValue(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    return { value: bytesToBase64(bytes), codec: 'binary' };
  }
  return { value, codec: inferDefaultCodec(value) };
}
