/* eslint-env jest */
/**
 * @fileoverview Enforce ARIA state and property values are valid.
 * @author Ethan Cohen
 */

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

import { aria } from 'aria-query';
import { RuleTester } from 'eslint';
import parserOptionsMapper from '../../__util__/parserOptionsMapper';
import rule, { validityCheck } from '../../../src/rules/aria-proptypes';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const ruleTester = new RuleTester();

const errorMessage = (name) => {
  const {
    type,
    values: permittedValues,
  } = aria.get(name.toLowerCase());

  switch (type) {
    case 'tristate':
      return `The value for ${name} must be a boolean or the string "mixed".`;
    case 'token':
      return `The value for ${name} must be a single token from the following: ${permittedValues}.`;
    case 'tokenlist':
      return `The value for ${name} must be a list of one or more \
tokens from the following: ${permittedValues}.`;
    case 'boolean':
    case 'string':
    case 'integer':
    case 'number':
    default:
      return `The value for ${name} must be a ${type}.`;
  }
};

describe('validityCheck', () => {
  it('should false for an unknown expected type', () => {
    expect(validityCheck(
      null,
      null,
    )).toBe(false);
  });
});

ruleTester.run('aria-proptypes', rule, {
  valid: [
    // DON'T TEST INVALID ARIA-* PROPS
    { code: '<div aria-foo="true" />' },
    { code: '<div abcaria-foo="true" />' },

    // BOOLEAN
    { code: '<div aria-hidden={true} />' },
    { code: '<div aria-hidden="true" />' },
    { code: '<div aria-hidden={"false"} />' },
    { code: '<div aria-hidden={!false} />' },
    { code: '<div aria-hidden />' },
    { code: '<div aria-hidden={false} />' },
    { code: '<div aria-hidden={!true} />' },
    { code: '<div aria-hidden={!"yes"} />' },
    { code: '<div aria-hidden={foo} />' },
    { code: '<div aria-hidden={foo.bar} />' },
    { code: '<div aria-hidden={<div />} />' },

    // STRING
    { code: '<div aria-label="Close" />' },
    { code: '<div aria-label={`Close`} />' },
    { code: '<div aria-label={foo} />' },
    { code: '<div aria-label={foo.bar} />' },
    { code: '<input aria-invalid={error ? "true" : "false"} />' },
    { code: '<input aria-invalid={undefined ? "true" : "false"} />' },

    // TRISTATE
    { code: '<div aria-checked={true} />' },
    { code: '<div aria-checked="true" />' },
    { code: '<div aria-checked={"false"} />' },
    { code: '<div aria-checked={!false} />' },
    { code: '<div aria-checked />' },
    { code: '<div aria-checked={false} />' },
    { code: '<div aria-checked={!true} />' },
    { code: '<div aria-checked={!"yes"} />' },
    { code: '<div aria-checked={foo} />' },
    { code: '<div aria-checked={foo.bar} />' },
    { code: '<div aria-checked="mixed" />' },
    { code: '<div aria-checked={`mixed`} />' },

    // INTEGER
    { code: '<div aria-level={123} />' },
    { code: '<div aria-level={-123} />' },
    { code: '<div aria-level={+123} />' },
    { code: '<div aria-level={~123} />' },
    { code: '<div aria-level={"123"} />' },
    { code: '<div aria-level={`123`} />' },
    { code: '<div aria-level="123" />' },
    { code: '<div aria-level={foo} />' },
    { code: '<div aria-level={foo.bar} />' },

    // NUMBER
    { code: '<div aria-valuemax={123} />' },
    { code: '<div aria-valuemax={-123} />' },
    { code: '<div aria-valuemax={+123} />' },
    { code: '<div aria-valuemax={~123} />' },
    { code: '<div aria-valuemax={"123"} />' },
    { code: '<div aria-valuemax={`123`} />' },
    { code: '<div aria-valuemax="123" />' },
    { code: '<div aria-valuemax={foo} />' },
    { code: '<div aria-valuemax={foo.bar} />' },

    // TOKEN
    { code: '<div aria-sort="ascending" />' },
    { code: '<div aria-sort="ASCENDING" />' },
    { code: '<div aria-sort={"ascending"} />' },
    { code: '<div aria-sort={`ascending`} />' },
    { code: '<div aria-sort="descending" />' },
    { code: '<div aria-sort={"descending"} />' },
    { code: '<div aria-sort={`descending`} />' },
    { code: '<div aria-sort="none" />' },
    { code: '<div aria-sort={"none"} />' },
    { code: '<div aria-sort={`none`} />' },
    { code: '<div aria-sort="other" />' },
    { code: '<div aria-sort={"other"} />' },
    { code: '<div aria-sort={`other`} />' },
    { code: '<div aria-sort={foo} />' },
    { code: '<div aria-sort={foo.bar} />' },
    { code: '<div aria-invalid={true} />' },
    { code: '<div aria-invalid="true" />' },
    { code: '<div aria-invalid={false} />' },
    { code: '<div aria-invalid="false" />' },
    { code: '<div aria-invalid="grammar" />' },
    { code: '<div aria-invalid="spelling" />' },

    // TOKENLIST
    { code: '<div aria-relevant="additions" />' },
    { code: '<div aria-relevant={"additions"} />' },
    { code: '<div aria-relevant={`additions`} />' },
    { code: '<div aria-relevant="additions removals" />' },
    { code: '<div aria-relevant="additions additions" />' },
    { code: '<div aria-relevant={"additions removals"} />' },
    { code: '<div aria-relevant={`additions removals`} />' },
    { code: '<div aria-relevant="additions removals text" />' },
    { code: '<div aria-relevant={"additions removals text"} />' },
    { code: '<div aria-relevant={`additions removals text`} />' },
    { code: '<div aria-relevant="additions removals text all" />' },
    { code: '<div aria-relevant={"additions removals text all"} />' },
    { code: '<div aria-relevant={`removals additions text all`} />' },
    { code: '<div aria-relevant={foo} />' },
    { code: '<div aria-relevant={foo.bar} />' },
  ].map(parserOptionsMapper),
  invalid: [
    // BOOLEAN
    {
      code: '<div aria-hidden={undefined} />',
      errors: [errorMessage('aria-hidden')],
    },
    { code: '<div aria-hidden="yes" />', errors: [errorMessage('aria-hidden')] },
    { code: '<div aria-hidden="no" />', errors: [errorMessage('aria-hidden')] },
    { code: '<div aria-hidden={1234} />', errors: [errorMessage('aria-hidden')] },
    {
      code: '<div aria-hidden={`${abc}`} />',
      errors: [errorMessage('aria-hidden')],
    },

    // STRING
    { code: '<div aria-label={undefined} />', errors: [errorMessage('aria-label')] },
    { code: '<div aria-label />', errors: [errorMessage('aria-label')] },
    { code: '<div aria-label={true} />', errors: [errorMessage('aria-label')] },
    { code: '<div aria-label={false} />', errors: [errorMessage('aria-label')] },
    { code: '<div aria-label={1234} />', errors: [errorMessage('aria-label')] },
    { code: '<div aria-label={!true} />', errors: [errorMessage('aria-label')] },

    // TRISTATE
    {
      code: '<div aria-checked={undefined} />',
      errors: [errorMessage('aria-checked')],
    },
    { code: '<div aria-checked="yes" />', errors: [errorMessage('aria-checked')] },
    { code: '<div aria-checked="no" />', errors: [errorMessage('aria-checked')] },
    { code: '<div aria-checked={1234} />', errors: [errorMessage('aria-checked')] },
    {
      code: '<div aria-checked={`${abc}`} />',
      errors: [errorMessage('aria-checked')],
    },

    // INTEGER
    { code: '<div aria-level={undefined} />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level="yes" />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level="no" />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level={`abc`} />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level={true} />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level={"false"} />', errors: [errorMessage('aria-level')] },
    { code: '<div aria-level={!"false"} />', errors: [errorMessage('aria-level')] },

    // NUMBER
    {
      code: '<div aria-valuemax={undefined} />',
      errors: [errorMessage('aria-valuemax')],
    },
    { code: '<div aria-valuemax="yes" />', errors: [errorMessage('aria-valuemax')] },
    { code: '<div aria-valuemax="no" />', errors: [errorMessage('aria-valuemax')] },
    {
      code: '<div aria-valuemax={`abc`} />',
      errors: [errorMessage('aria-valuemax')],
    },
    {
      code: '<div aria-valuemax={true} />',
      errors: [errorMessage('aria-valuemax')],
    },
    { code: '<div aria-valuemax />', errors: [errorMessage('aria-valuemax')] },
    {
      code: '<div aria-valuemax={"false"} />',
      errors: [errorMessage('aria-valuemax')],
    },
    {
      code: '<div aria-valuemax={!"false"} />',
      errors: [errorMessage('aria-valuemax')],
    },

    // TOKEN
    { code: '<div aria-sort="" />', errors: [errorMessage('aria-sort')] },
    { code: '<div aria-sort="descnding" />', errors: [errorMessage('aria-sort')] },
    { code: '<div aria-sort />', errors: [errorMessage('aria-sort')] },
    { code: '<div aria-sort={undefined} />', errors: [errorMessage('aria-sort')] },
    { code: '<div aria-sort={true} />', errors: [errorMessage('aria-sort')] },
    { code: '<div aria-sort={"false"} />', errors: [errorMessage('aria-sort')] },
    {
      code: '<div aria-sort="ascending descending" />',
      errors: [errorMessage('aria-sort')],
    },

    // TOKENLIST
    { code: '<div aria-relevant="" />', errors: [errorMessage('aria-relevant')] },
    {
      code: '<div aria-relevant="foobar" />',
      errors: [errorMessage('aria-relevant')],
    },
    { code: '<div aria-relevant />', errors: [errorMessage('aria-relevant')] },
    {
      code: '<div aria-relevant={undefined} />',
      errors: [errorMessage('aria-relevant')],
    },
    {
      code: '<div aria-relevant={true} />',
      errors: [errorMessage('aria-relevant')],
    },
    {
      code: '<div aria-relevant={"false"} />',
      errors: [errorMessage('aria-relevant')],
    },
    {
      code: '<div aria-relevant="additions removalss" />',
      errors: [errorMessage('aria-relevant')],
    },
    {
      code: '<div aria-relevant="additions removalss " />',
      errors: [errorMessage('aria-relevant')],
    },
  ].map(parserOptionsMapper),
});
