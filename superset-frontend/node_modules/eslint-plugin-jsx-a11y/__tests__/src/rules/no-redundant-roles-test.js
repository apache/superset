/* eslint-env jest */
/**
 * @fileoverview Enforce explicit role property is not the
 * same as implicit default role property on element.
 * @author Ethan Cohen <@evcohen>
 */

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

import { RuleTester } from 'eslint';
import parserOptionsMapper from '../../__util__/parserOptionsMapper';
import rule from '../../../src/rules/no-redundant-roles';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const ruleTester = new RuleTester();

const expectedError = (element, implicitRole) => ({
  message: `The element ${element} has an implicit role of ${implicitRole}. Defining this explicitly is redundant and should be avoided.`,
  type: 'JSXOpeningElement',
});

ruleTester.run('no-redundant-roles', rule, {
  valid: [
    { code: '<div />;' },
    { code: '<button role="main" />' },
    { code: '<MyComponent role="button" />' },
    { code: '<button role={`${foo}button`} />' },
  ].map(parserOptionsMapper),
  invalid: [
    { code: '<button role="button" />', errors: [expectedError('button', 'button')] },
    { code: '<body role="DOCUMENT" />', errors: [expectedError('body', 'document')] },
    { code: '<button role={`${undefined}button`} />', errors: [expectedError('button', 'button')] },
  ].map(parserOptionsMapper),
});
