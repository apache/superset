/* eslint-env jest */
/**
 * @fileoverview Enforce label tags have htmlFor attribute.
 * @author Ethan Cohen
 */

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

import { RuleTester } from 'eslint';
import parserOptionsMapper from '../../__util__/parserOptionsMapper';
import rule from '../../../src/rules/label-has-for';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const ruleTester = new RuleTester();

const expectedError = {
  message: 'Form label must have associated control',
  type: 'JSXOpeningElement',
};

const array = [{
  components: ['Label', 'Descriptor'],
}];
const optionsRequiredNesting = [{
  required: 'nesting',
}];
const optionsRequiredSome = [{
  required: { some: ['nesting', 'id'] },
}];
const optionsRequiredEvery = [{
  required: { every: ['nesting', 'id'] },
}];

ruleTester.run('label-has-for', rule, {
  valid: [
    // DEFAULT ELEMENT 'label' TESTS
    { code: '<label htmlFor="foo" />' },
    { code: '<label htmlFor={"foo"} />' },
    { code: '<label htmlFor={foo} />' },
    { code: '<label htmlFor={`${id}`} />' },
    { code: '<div />' },
    { code: '<label htmlFor="foo">Test!</label>' },
    { code: '<Label />' }, // lower-case convention refers to real HTML elements.
    { code: '<Label htmlFor="foo" />' },
    { code: '<UX.Layout>test</UX.Layout>' },

    // CUSTOM ELEMENT ARRAY OPTION TESTS
    { code: '<Label htmlFor="foo" />', options: array },
    { code: '<Label htmlFor={"foo"} />', options: array },
    { code: '<Label htmlFor={foo} />', options: array },
    { code: '<Label htmlFor={`${id}`} />', options: array },
    { code: '<div />', options: array },
    { code: '<Label htmlFor="foo">Test!</Label>', options: array },
    { code: '<Descriptor htmlFor="foo" />', options: array },
    { code: '<Descriptor htmlFor={"foo"} />', options: array },
    { code: '<Descriptor htmlFor={foo} />', options: array },
    { code: '<Descriptor htmlFor={`${id}`} />', options: array },
    { code: '<div />', options: array },
    { code: '<Descriptor htmlFor="foo">Test!</Descriptor>', options: array },
    { code: '<label><input /></label>', options: optionsRequiredNesting },
    { code: '<label><input /></label>', options: optionsRequiredSome },
    { code: '<label htmlFor="foo" />', options: optionsRequiredSome },
    { code: '<label htmlFor="foo"><input /></label>', options: optionsRequiredEvery },
  ].map(parserOptionsMapper),
  invalid: [
    // DEFAULT ELEMENT 'label' TESTS
    { code: '<label id="foo" />', errors: [expectedError] },
    { code: '<label htmlFor={undefined} />', errors: [expectedError] },
    { code: '<label htmlFor={`${undefined}`} />', errors: [expectedError] },
    { code: '<label>First Name</label>', errors: [expectedError] },
    { code: '<label {...props}>Foo</label>', errors: [expectedError] },
    { code: '<label><input /></label>', errors: [expectedError] },

    // CUSTOM ELEMENT ARRAY OPTION TESTS
    { code: '<Label id="foo" />', errors: [expectedError], options: array },
    {
      code: '<Label htmlFor={undefined} />',
      errors: [expectedError],
      options: array,
    },
    {
      code: '<Label htmlFor={`${undefined}`} />',
      errors: [expectedError],
      options: array,
    },
    { code: '<Label>First Name</Label>', errors: [expectedError], options: array },
    {
      code: '<Label {...props}>Foo</Label>',
      errors: [expectedError],
      options: array,
    },
    { code: '<Descriptor id="foo" />', errors: [expectedError], options: array },
    {
      code: '<Descriptor htmlFor={undefined} />',
      errors: [expectedError],
      options: array,
    },
    {
      code: '<Descriptor htmlFor={`${undefined}`} />',
      errors: [expectedError],
      options: array,
    },
    {
      code: '<Descriptor>First Name</Descriptor>',
      errors: [expectedError],
      options: array,
    },
    {
      code: '<Descriptor {...props}>Foo</Descriptor>',
      errors: [expectedError],
      options: array,
    },
    { code: '<label htmlFor="foo" />', errors: [expectedError], options: optionsRequiredNesting },
    { code: '<label>First Name</label>', errors: [expectedError], options: optionsRequiredNesting },
    { code: '<label>First Name</label>', errors: [expectedError], options: optionsRequiredSome },
    { code: '<label htmlFor="foo" />', errors: [expectedError], options: optionsRequiredEvery },
    { code: '<label><input /></label>', errors: [expectedError], options: optionsRequiredEvery },
    { code: '<label>First Name</label>', errors: [expectedError], options: optionsRequiredEvery },
  ].map(parserOptionsMapper),
});
