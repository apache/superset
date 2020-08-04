var assert = require('assert'),
    latex = require('../../lib/utils/latex');

describe('util.latex', function() {
  it('should convert symbols with underscores', function () {
    assert.equal(latex.toSymbol('alpha_1'), 'alpha\\_1');
  });

  it('should convert special units', function () {
    assert.equal(latex.toSymbol('deg', true), '^\\circ');
  });

  it('should convert normal units', function () {
    assert.equal(latex.toSymbol('cm', true), '\\mathrm{cm}');
  });

  it('should escape strings', function () {
    var string = 'space tab\tunderscore_bla$/';

    assert.equal(latex.toSymbol(string), 'space~tab\\qquad{}underscore\\_bla\\$/');
  });
});
