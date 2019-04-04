/* eslint-env jest */
/**
 * @fileoverview Enforce links may not point to just #.
 * @author Ethan Cohen
 */

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

import { RuleTester } from 'eslint';
import parserOptionsMapper from '../../__util__/parserOptionsMapper';
import rule from '../../../src/rules/href-no-hash';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const ruleTester = new RuleTester();

const expectedError = {
  message: 'Links must not point to "#". Use a more descriptive href or use a button instead.',
  type: 'JSXOpeningElement',
};

const components = [{
  components: ['Anchor', 'Link'],
}];
const specialLink = [{
  specialLink: ['hrefLeft', 'hrefRight'],
}];
const componentsAndSpecialLink = [{
  components: ['Anchor'],
  specialLink: ['hrefLeft'],
}];

ruleTester.run('href-no-hash', rule, {
  valid: [
    // DEFAULT ELEMENT 'a' TESTS
    { code: '<Anchor />;' },
    { code: '<a {...props} />' },
    { code: '<a href="foo" />' },
    { code: '<a href={foo} />' },
    { code: '<a href="/foo" />' },
    { code: '<a href={`${undefined}`} />' },
    { code: '<div href="foo" />' },
    { code: '<a href={`${undefined}foo`}/>' },
    { code: '<a href={`#${undefined}foo`}/>' },
    { code: '<a href={`#foo`}/>' },
    { code: '<a href={"foo"}/>' },
    { code: '<a href="#foo" />' },
    { code: '<UX.Layout>test</UX.Layout>' },
    { code: '<a href={this} />' },

    // CUSTOM ELEMENT TEST FOR ARRAY OPTION
    { code: '<Anchor />;', options: components },
    { code: '<Anchor {...props} />', options: components },
    { code: '<Anchor href="foo" />', options: components },
    { code: '<Anchor href={foo} />', options: components },
    { code: '<Anchor href="/foo" />', options: components },
    { code: '<Anchor href={`${undefined}`} />', options: components },
    { code: '<div href="foo" />', options: components },
    { code: '<Anchor href={`${undefined}foo`}/>', options: components },
    { code: '<Anchor href={`#${undefined}foo`}/>', options: components },
    { code: '<Anchor href={`#foo`}/>', options: components },
    { code: '<Anchor href={"foo"}/>', options: components },
    { code: '<Anchor href="#foo" />', options: components },
    { code: '<Link />;', options: components },
    { code: '<Link {...props} />', options: components },
    { code: '<Link href="foo" />', options: components },
    { code: '<Link href={foo} />', options: components },
    { code: '<Link href="/foo" />', options: components },
    { code: '<Link href={`${undefined}`} />', options: components },
    { code: '<div href="foo" />', options: components },
    { code: '<Link href={`${undefined}foo`}/>', options: components },
    { code: '<Link href={`#${undefined}foo`}/>', options: components },
    { code: '<Link href={`#foo`}/>', options: components },
    { code: '<Link href={"foo"}/>', options: components },
    { code: '<Link href="#foo" />', options: components },

    // CUSTOM PROP TESTS
    { code: '<a />;', options: specialLink },
    { code: '<a {...props} />', options: specialLink },
    { code: '<a hrefLeft="foo" />', options: specialLink },
    { code: '<a hrefLeft={foo} />', options: specialLink },
    { code: '<a hrefLeft="/foo" />', options: specialLink },
    { code: '<a hrefLeft={`${undefined}`} />', options: specialLink },
    { code: '<div hrefLeft="foo" />', options: specialLink },
    { code: '<a hrefLeft={`${undefined}foo`}/>', options: specialLink },
    { code: '<a hrefLeft={`#${undefined}foo`}/>', options: specialLink },
    { code: '<a hrefLeft={`#foo`}/>', options: specialLink },
    { code: '<a hrefLeft={"foo"}/>', options: specialLink },
    { code: '<a hrefLeft="#foo" />', options: specialLink },
    { code: '<UX.Layout>test</UX.Layout>', options: specialLink },
    { code: '<a hrefRight={this} />', options: specialLink },
    { code: '<a />;', options: specialLink },
    { code: '<a {...props} />', options: specialLink },
    { code: '<a hrefRight="foo" />', options: specialLink },
    { code: '<a hrefRight={foo} />', options: specialLink },
    { code: '<a hrefRight="/foo" />', options: specialLink },
    { code: '<a hrefRight={`${undefined}`} />', options: specialLink },
    { code: '<div hrefRight="foo" />', options: specialLink },
    { code: '<a hrefRight={`${undefined}foo`}/>', options: specialLink },
    { code: '<a hrefRight={`#${undefined}foo`}/>', options: specialLink },
    { code: '<a hrefRight={`#foo`}/>', options: specialLink },
    { code: '<a hrefRight={"foo"}/>', options: specialLink },
    { code: '<a hrefRight="#foo" />', options: specialLink },
    { code: '<UX.Layout>test</UX.Layout>', options: specialLink },
    { code: '<a hrefRight={this} />', options: specialLink },

    // CUSTOM BOTH COMPONENTS AND SPECIALLINK TESTS
    { code: '<Anchor />;', options: componentsAndSpecialLink },
    { code: '<Anchor {...props} />', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft="foo" />', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={foo} />', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft="/foo" />', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={`${undefined}`} />', options: componentsAndSpecialLink },
    { code: '<div hrefLeft="foo" />', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={`${undefined}foo`}/>', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={`#${undefined}foo`}/>', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={`#foo`}/>', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={"foo"}/>', options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft="#foo" />', options: componentsAndSpecialLink },
    { code: '<UX.Layout>test</UX.Layout>', options: componentsAndSpecialLink },
  ].map(parserOptionsMapper),
  invalid: [
    // DEFAULT ELEMENT 'a' TESTS
    { code: '<a href="#" />', errors: [expectedError] },
    { code: '<a href={"#"} />', errors: [expectedError] },
    { code: '<a href={`#${undefined}`} />', errors: [expectedError] },

    // CUSTOM ELEMENT TEST FOR ARRAY OPTION
    { code: '<Link href="#" />', errors: [expectedError], options: components },
    { code: '<Link href={"#"} />', errors: [expectedError], options: components },
    {
      code: '<Link href={`#${undefined}`} />',
      errors: [expectedError],
      options: components,
    },
    { code: '<Anchor href="#" />', errors: [expectedError], options: components },
    { code: '<Anchor href={"#"} />', errors: [expectedError], options: components },
    {
      code: '<Anchor href={`#${undefined}`} />',
      errors: [expectedError],
      options: components,
    },

    // CUSTOM PROP TESTS
    { code: '<a hrefLeft="#" />', errors: [expectedError], options: specialLink },
    { code: '<a hrefLeft={"#"} />', errors: [expectedError], options: specialLink },
    {
      code: '<a hrefLeft={`#${undefined}`} />',
      errors: [expectedError],
      options: specialLink,
    },
    { code: '<a hrefRight="#" />', errors: [expectedError], options: specialLink },
    { code: '<a hrefRight={"#"} />', errors: [expectedError], options: specialLink },
    {
      code: '<a hrefRight={`#${undefined}`} />',
      errors: [expectedError],
      options: specialLink,
    },

    // CUSTOM BOTH COMPONENTS AND SPECIALLINK TESTS
    { code: '<Anchor hrefLeft="#" />', errors: [expectedError], options: componentsAndSpecialLink },
    { code: '<Anchor hrefLeft={"#"} />', errors: [expectedError], options: componentsAndSpecialLink },
    {
      code: '<Anchor hrefLeft={`#${undefined}`} />',
      errors: [expectedError],
      options: componentsAndSpecialLink,
    },
  ].map(parserOptionsMapper),
});
