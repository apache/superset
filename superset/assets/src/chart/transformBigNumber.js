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
// This method transforms any BigNumber object in the given payload to its
// 64-bit float representation. It is a temporary fix so charts receive
// floats instead of BigNumber instances in their props to properly render.
import BigNumber from 'bignumber.js';

export default function transform(payload) {
  if (!payload) {
    return payload;
  } else if (BigNumber.isBigNumber(payload)) {
    return payload.toNumber();
  } else if (payload.constructor === Object) {
    for (const key in payload) {
      if (payload.hasOwnProperty(key)) {
        // Modify in place to prevent creating large payloads
        // eslint-disable-next-line no-param-reassign
        payload[key] = transform(payload[key]);
      }
    }
  } else if (payload.constructor === Array) {
    payload.forEach((elem, idx) => {
      // Modify in place to prevent creating large payloads
      // eslint-disable-next-line no-param-reassign
      payload[idx] = transform(elem);
    });
  }
  return payload;
}
