---
title: Testing Guidelines and Best Practices
sidebar_position: 1
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Testing Guidelines and Best Practices

We feel that tests are an important part of a feature and not an additional or optional effort. That's why we colocate test files with functionality and sometimes write tests upfront to help validate requirements and shape the API of our components. Every new component or file added should have an associated test file with the `.test` extension.

We use Jest, React Testing Library (RTL), and Cypress to write our unit, integration, and end-to-end tests. For each type, we have a set of best practices/tips described below:

## Jest

### Write simple, standalone tests

The importance of simplicity is often overlooked in test cases. Clear, dumb code should always be preferred over complex ones. The test cases should be pretty much standalone and should not involve any external logic if not absolutely necessary. That's because you want the corpus of the tests to be easy to read and understandable at first sight.

### Avoid nesting when you're testing

Avoid the use of `describe` blocks in favor of inlined tests. If your tests start to grow and you feel the need to group tests, prefer to break them into multiple test files. Check this awesome [article](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing) written by [Kent C. Dodds](https://kentcdodds.com/) about this topic.

### No warnings!

Your tests shouldn't trigger warnings. This is really common when testing async functionality. It's really difficult to read test results when we have a bunch of warnings.

### Example

You can find an example of a test [here](https://github.com/apache/superset/blob/e6c5bf4/superset-frontend/src/common/hooks/useChangeEffect/useChangeEffect.test.ts).

## React Testing Library (RTL)

### Keep accessibility in mind when writing your tests

One of the most important points of RTL is accessibility and this is also a very important point for us. We should try our best to follow the RTL [Priority](https://testing-library.com/docs/queries/about/#priority) when querying for elements in our tests. `getByTestId` is not viewable by the user and should only be used when the element isn't accessible in any other way.

### Don't use `act` unnecessarily

`render` and `fireEvent` are already wrapped in `act`, so wrapping them in `act` again is a common mistake. Some solutions to the warnings related to `act` might be found [here](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning).

### Be specific when using *ByRole

By using the `name` option we can point to the items by their accessible name. For example:

```jsx
screen.getByRole('button', { name: /hello world/i })
```

Using the `name` property also avoids breaking the tests in the future if other components with the same role are added.

### userEvent vs fireEvent

Prefer the [user-event](https://github.com/testing-library/user-event) library, which provides a more advanced simulation of browser interactions than the built-in [fireEvent](https://testing-library.com/docs/dom-testing-library/api-events/#fireevent) method.

### Usage of waitFor

- [Prefer to use `find`](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#using-waitfor-to-wait-for-elements-that-can-be-queried-with-find) over `waitFor` when you're querying for elements. Even though both achieve the same objective, the `find` version is simpler and you'll get better error messages.
- Prefer to use only [one assertion at a time](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#having-multiple-assertions-in-a-single-waitfor-callback). If you put multiple assertions inside a `waitFor` we could end up waiting for the whole block timeout before seeing a test failure even if the failure occurred at the first assertion. By putting a single assertion in there, we can improve on test execution time.
- Do not perform [side-effects](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#performing-side-effects-in-waitfor) inside `waitFor`. The callback can be called a non-deterministic number of times and frequency (it's called both on an interval as well as when there are DOM mutations). So this means that your side-effect could run multiple times.

### Example

You can find an example of a test [here](https://github.com/apache/superset/blob/master/superset-frontend/src/dashboard/components/PublishedStatus/PublishedStatus.test.tsx).

## Cypress

### Prefer to use Cypress for e2e testing and RTL for integration testing

Here it's important to make the distinction between e2e and integration testing. This [article](https://www.onpathtesting.com/blog/end-to-end-vs-integration-testing) gives an excellent definition:

> End-to-end testing verifies that your software works correctly from the beginning to the end of a particular user flow. It replicates expected user behavior and various usage scenarios to ensure that your software works as whole. End-to-end testing uses a production equivalent environment and data to simulate real-world situations and may also involve the integrations your software has with external applications.

> A typical software project consists of multiple software units, usually coded by different developers. Integration testing combines those software units logically and tests them as a group.
> Essentially, integration testing verifies whether or not the individual modules or services that make up your application work well together. The purpose of this level of testing is to expose defects in the interaction between these software modules when they are integrated.

Do not use Cypress when RTL can do it better and faster. Many of the Cypress tests that we have right now, fall into the integration testing category and can be ported to RTL which is much faster and gives more immediate feedback. Cypress should be used mainly for end-to-end testing, replicating the user experience, with positive and negative flows.

### Isolated and standalone tests

Tests should never rely on other tests to pass. This might be hard when a single user is used for testing as data will be stored in the database. At every new test, we should reset the database.

### Cleaning state

Cleaning the state of the application, such as resetting the DB, or in general, any state that might affect consequent tests should always be done in the `beforeEach` hook and never in the `afterEach` one as the `beforeEach` is guaranteed to run, while the test might never reach the point to run the `afterEach` hook. One example would be if you refresh Cypress in the middle of the test. At this point, you will have built up a partial state in the database, and your clean-up function will never get called. You can read more about it [here](https://docs.cypress.io/guides/references/best-practices#Using-after-or-afterEach-hooks).

### Unnecessary use of `cy.wait`

- Unnecessary when using `cy.request()` as it will resolve when a response is received from the server
- Unnecessary when using `cy.visit()` as it resolves only when the page fires the load event
- Unnecessary when using `cy.get()`. When the selector should wait for a request to happen, aliases would come in handy:

```js
cy.intercept('GET', '/users', [{ name: 'Maggy' }, { name: 'Joan' }]).as('getUsers')
cy.get('#fetch').click()
cy.wait('@getUsers') // <--- wait explicitly for this route to finish
cy.get('table tr').should('have.length', 2)
```

### Accessibility and Resilience

The same accessibility principles in the RTL section apply here. Use accessible selectors when querying for elements. Those principles also help to isolate selectors from eventual CSS and JS changes and improve the resilience of your tests.

## References

- [Avoid Nesting when you're Testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing)
- [RTL - Queries](https://testing-library.com/docs/queries/about/#priority)
- [Fix the "not wrapped in act(...)" warning](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning)
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [ARIA Roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
- [Cypress - Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [End-to-end vs integration tests: what's the difference?](https://www.onpathtesting.com/blog/end-to-end-vs-integration-testing)
