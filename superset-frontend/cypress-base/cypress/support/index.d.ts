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
// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONObject = { [member: string]: JSONValue };
type JSONArray = JSONValue[];

declare namespace Cypress {
  interface Chainable {
    /**
     * Login test user.
     */
    login(): void;

    visitChartByParams(params: string | Record<string, unknown>): cy;
    visitChartByName(name: string): cy;
    visitChartById(id: number): cy;

    /**
     * Verify a waitXHR response and parse response JSON.
     */
    verifyResponseCodes(
      xhr: WaitXHR,
      callback?: (result: JSONValue) => void,
    ): cy;

    /**
     * Verify slice container renders.
     */
    verifySliceContainer(chartSelector: JQuery.Selector): cy;

    /**
     * Verify slice successfully loaded.
     */
    verifySliceSuccess(options: {
      waitAlias: string;
      querySubstring?: string | RegExp;
      chartSelector?: JQuery.Selector;
    }): cy;
  }
}

declare module '@cypress/code-coverage/task';
