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

import JSDOMEnvironment from 'jest-environment-jsdom';

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.AbortSignal = AbortSignal;
    this.global.AbortController = AbortController;

    // WORKAROUND: Mock MessageChannel to prevent Jest test hanging
    // 
    // Issue: rc-overflow@1.4.1 (used by Ant Design v5 components: Select, Menu, Picker)
    // creates MessageChannel handles for responsive overflow detection that remain 
    // open after test completion, causing Jest to hang with:
    // "Jest did not exit one second after the test run has completed"
    //
    // Root Cause: Ant Design v5 upgrade (commit dd129fa40370c93da1d0d536be870a5f363364fb, PR #31590)
    // introduced rc-overflow library which uses MessageChannel for micro-task scheduling
    //
    // Solution: Set MessageChannel to undefined forces rc-overflow to use its built-in
    // requestAnimationFrame fallback, which Jest handles properly without hanging
    //
    // Impact: No functional test coverage loss - JSDOM can't test visual overflow anyway.
    // All component logic (interactions, state, API calls) still tested normally.
    //
    // Future Removal Conditions:
    // - rc-overflow updates to properly clean up MessagePorts in test environments
    // - Jest updates to handle MessageChannel/MessagePort cleanup better  
    // - Ant Design switches away from rc-overflow
    // - We switch away from Ant Design v5
    //
    // To verify if still needed: Remove these lines and run `npm test -- --shard=4/8`
    // If tests hang, the workaround is still required.
    //
    // Related: See PROJECT.md for full investigation details
    this.global.MessageChannel = undefined as any;
    this.global.MessagePort = undefined as any;
  }
}
