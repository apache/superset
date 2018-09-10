import { it, describe } from 'mocha';
import { expect } from 'chai';
import ColorSchemeManager from '../../../src/modules/ColorSchemeManager';

describe.only('ColorSchemeManager', () => {
  it('The class constructor cannot be accessed directly', () => {
    expect(ColorSchemeManager).to.not.be.a('Function');
  });
  it('is a singleton class that returns an instance via static function getInstance()', () => {

  });
});
