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
 * Resolve the codec, request-body value, and `isBinary` flag for a
 * `set()` call.
 *
 * `isBinary` is caller-driven, not inferred from `value`'s JS type: it
 * tells the REST API whether `value` on the wire is a base64 string that
 * must be decoded before being handed to whichever codec was chosen,
 * since JSON has no byte type and there is no way for the server to
 * infer this from the JSON value alone. When set and `value` is a
 * `Uint8Array`/`ArrayBuffer`, it is base64-encoded here for transport; a
 * caller that already has a base64 string (e.g. encoded for a codec this
 * SDK doesn't know about) can pass that directly instead.
 */
export function resolveSetPayload<T>(
  value: T,
  options: { codec?: string; isBinary?: boolean } | undefined,
): { value: unknown; codec: string; isBinary: boolean } {
  const explicitCodec = options?.codec;
  const binary = options?.isBinary ?? false;
  if (binary && isBinaryValue(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    return {
      value: bytesToBase64(bytes),
      codec: explicitCodec ?? 'binary',
      isBinary: true,
    };
  }
  return {
    value,
    codec: explicitCodec ?? (binary ? 'binary' : 'json'),
    isBinary: binary,
  };
}
