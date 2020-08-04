import { expect } from 'chai';
import React from 'react';

import { between } from '..';

import callValidator from './_callValidator';

describe('between', () => {
  it('returns a function', () => {
    expect(typeof between({ gt: 0, lt: 1 })).to.equal('function');
  });

  it('throws with non-number values', () => {
    expect(() => between({ gt: 'foo' })).to.throw(TypeError);
    expect(() => between({ lt: 'foo' })).to.throw(TypeError);
    expect(() => between({ gte: 'foo' })).to.throw(TypeError);
    expect(() => between({ lte: 'foo' })).to.throw(TypeError);
    expect(() => between({ gt: true })).to.throw(TypeError);
    expect(() => between({ lt: true })).to.throw(TypeError);
    expect(() => between({ gte: true })).to.throw(TypeError);
    expect(() => between({ lte: true })).to.throw(TypeError);
    expect(() => between({ gt: [] })).to.throw(TypeError);
    expect(() => between({ lt: [] })).to.throw(TypeError);
    expect(() => between({ gte: [] })).to.throw(TypeError);
    expect(() => between({ lte: [] })).to.throw(TypeError);
    expect(() => between({ gt: {} })).to.throw(TypeError);
    expect(() => between({ lt: {} })).to.throw(TypeError);
    expect(() => between({ gte: {} })).to.throw(TypeError);
    expect(() => between({ lte: {} })).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName) {
    const error = callValidator(validator, element, propName, '"between" test');
    expect(error).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    const error = callValidator(validator, element, propName, '"between" test');
    expect(error).to.be.instanceOf(Error);
  }

  it('fails when the prop value is not a number', () => {
    assertFails(
      between({ gte: 1, lte: 3 }),
      (<div a="1" />),
      'a',
    );
    assertFails(
      between({ gte: 1, lte: 3 }).isRequired,
      (<div a="1" />),
      'a',
    );
  });

  it('passes when inside the range', () => {
    assertPasses(between({ gte: -1, lt: 2 }), (<div a={-1} />), 'a');
    assertPasses(between({ gte: -1 }), (<div a={-1} />), 'a');
    assertPasses(between({ gte: -1, lte: 2 }), (<div a={2} />), 'a');
    assertPasses(between({ lte: 2 }), (<div a={2} />), 'a');

    assertPasses(between({ gt: -1, lt: 2 }), (<div a={-0} />), 'a');
    assertPasses(between({ gt: -1, lt: 2 }), (<div a={0} />), 'a');
    assertPasses(between({ gt: -1, lt: 2 }), (<div a={1} />), 'a');
  });

  it('fails when outside the range', () => {
    assertFails(between({ gt: -1, lt: 2 }), (<div a={-1} />), 'a');
    assertFails(between({ gt: -1 }), (<div a={-1} />), 'a');
    assertFails(between({ gt: 1, lt: 2 }), (<div a={2} />), 'a');
    assertFails(between({ lt: 2 }), (<div a={2} />), 'a');

    assertFails(between({ gt: 0, lt: 2 }), (<div a={-0} />), 'a');
    assertFails(between({ gt: 0, lt: 2 }), (<div a={0} />), 'a');
    assertFails(between({ gt: -1, lt: 1 }), (<div a={1} />), 'a');
  });

  it('fails with thunks that return non-numbers', () => {
    assertFails(
      between({
        gt() { return false; },
        lt() { return []; },
      }),
      (<div value={3} />),
      'value',
    );
    assertFails(
      between({
        gt() { return false; },
        lt() { return []; },
      }).isRequired,
      (<div value={3} />),
      'value',
    );
  });

  it('works with functions', () => {
    assertPasses(
      between({
        gt({ min }) { return min; },
        lt({ max }) { return max; },
      }),
      (<div min={1} max={3} value={2} />),
      'value',
    );
    assertPasses(
      between({
        gt({ min }) { return min; },
        lt({ max }) { return max; },
      }).isRequired,
      (<div min={1} max={3} value={2} />),
      'value',
    );
    assertPasses(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }),
      (<div min={1} max={3} value={2} />),
      'value',
    );
    assertPasses(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }).isRequired,
      (<div min={1} max={3} value={2} />),
      'value',
    );
    assertPasses(
      between({
        gte: 1,
        lte({ max }) { return max; },
      }),
      (<div max={3} value={2} />),
      'value',
    );

    assertFails(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }),
      (<div min={1} max={3} value={0} />),
      'value',
    );
    assertFails(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }).isRequired,
      (<div min={1} max={3} value={0} />),
      'value',
    );
    assertFails(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }),
      (<div min={1} max={3} value={4} />),
      'value',
    );
    assertFails(
      between({
        gte({ min }) { return min; },
        lte({ max }) { return max; },
      }).isRequired,
      (<div min={1} max={3} value={4} />),
      'value',
    );
    assertFails(
      between({
        gt({ min }) { return min; },
        lt({ max }) { return max; },
      }),
      (<div min={1} max={3} value={1} />),
      'value',
    );
    assertFails(
      between({
        gt({ min }) { return min; },
        lt({ max }) { return max; },
      }),
      (<div min={1} max={3} value={3} />),
      'value',
    );
  });
});
