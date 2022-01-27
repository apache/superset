/*
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
export default async function parseResponse(apiPromise, parseMethod) {
    const response = await apiPromise;
    // reject failed HTTP requests with the raw response
    if (!response.ok) {
        return Promise.reject(response);
    }
    if (parseMethod === null || parseMethod === 'raw') {
        return response;
    }
    if (parseMethod === 'text') {
        const text = await response.text();
        const result = {
            response,
            text,
        };
        return result;
    }
    // by default treat this as json
    if (parseMethod === undefined || parseMethod === 'json') {
        const json = await response.json();
        const result = {
            json,
            response,
        };
        return result;
    }
    throw new Error(`Expected parseResponse=json|text|raw|null, got '${parseMethod}'.`);
}
//# sourceMappingURL=parseResponse.js.map