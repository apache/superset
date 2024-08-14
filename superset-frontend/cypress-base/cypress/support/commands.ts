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
/// <reference types="cypress" />
import 'cypress-wait-until';

declare global {
  namespace Cypress {
    interface Chainable {
      retryAssertion(
        assertionFn: () => void,
        options?: Partial<WaitUntilOptions>,
      ): Chainable<any>;
    }
  }
}

interface WaitUntilOptions {
  timeout?: number;
  interval?: number;
  errorMsg?: string;
  verbose?: boolean;
}

Cypress.Commands.add('retryAssertion', (assertionFn, options = {}) => {
  const defaultOptions: WaitUntilOptions = { timeout: 10000, interval: 1000 };
  const opts = { ...defaultOptions, ...options };

  return cy.waitUntil(assertionFn, opts);
});

export {}; // This empty export is necessary to make this a module
