/**
 * Loop through all entries in our user agents object and test everything.
 *
 * @see  src/useragents.js
 * @author hannes.diercks@jimdo.com
 */

var g
  , ua
  , p
  , assert = require('assert')
  , browser = require('../src/bowser')
  , allUserAgents = require('../src/useragents').useragents

/**
 * Get the length of an object.
 * http://stackoverflow.com/questions/5223/length-of-javascript-object-ie-associative-array
 *
 * @param  {Object} obj
 * @return {Number}
 */
function objLength(obj) {
  var size = 0
    , key
  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++
  }
  return size
}

function objKeys(obj) {
  var keys = []
    , key
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      keys.push(key)
    }
  }
  keys.sort();
  return keys.join(', ')
}

/* Groups */
for (g in allUserAgents) { (function(group, userAgents) {
  describe(group, function() {

    /* User Agents */
    for (ua in userAgents) { (function(userAgent, expections) {
      describe('user agent "' + userAgent + '"', function() {

        expections.name = group

        /* Get the result from bowser. */
        var result = browser._detect(userAgent)

        /* At first, check if the result has the correct length. */
        it('should have ' + objLength(expections) + ' properties', function() {
          assert.equal(objKeys(result), objKeys(expections))
        })

        /* Properties */
        for (p in expections) { (function(property, value, resultValue) {

          /* Now ensure correctness of every property. */
          it('\'s Property "' + property + '" should be ' + value, function() {
            assert.equal(resultValue, value)
          })

        })(p, expections[p], result[p])}

      })
    })(ua, userAgents[ua])}

  })
})(g, allUserAgents[g])}

var comparisionsTasks = [
  ['9.0', '10', -1],
  ['11', '10', 1],
  ['1.10.2.1',  '1.8.2.1.90', 1],
  ['1.010.2.1', '1.08.2.1.90', 1],
  ['1.10.2.1', '1.10.2.1', 0],
  ['1.10.2.1', '1.0800.2', -1],
  ['1.0.0-alpha', '1.0.0-alpha.1', -1],
  ['1.0.0-alpha.1', '1.0.0-alpha.beta', -1],
  ['1.0.0-alpha.beta', '1.0.0-beta', -1],
  ['1.0.0-beta', '1.0.0-beta.2', -1],
  ['1.0.0-beta.11', '1.0.0-rc.1', -1],
  ['1.0.0-rc.1', '1.0.0', -1]
];

describe('Browser versions comparision', function() {
  for(g in comparisionsTasks) {
    var task = comparisionsTasks[g],
        version = task[0],
        version2 = task[1],
        matching = task[2] === 0 ? ' == ' : (task[2] > 0) ? ' > ' : ' < ';
    it('version ' + version + ' should be' + matching + 'version ' + version2, function(){
      assert.equal(browser.compareVersions([version, version2]), task[2]);
    });
  }
});

describe('Unsupported browser check', function() {

  before(function() {
    this.ie10_6 = "Mozilla/5.0 (compatible; MSIE 10.6; Windows NT 6.1; Trident/5.0; InfoPath.2; SLCC1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET CLR 2.0.50727) 3gpp-gba UNTRUSTED/1.0";
  });

  it('should be passed by #isUnsupportedBrowser for IE10.6 and for IE10 miminal version specified', function() {
    var unsupported = browser.isUnsupportedBrowser({msie: "10"}, this.ie10_6);
    assert.equal(unsupported, false);
  });

  it('should be passed by #isUnsupportedBrowser for IE10.6 and for IE10 miminal version specified in strict mode', function() {
    var unsupported = browser.isUnsupportedBrowser({msie: "10"}, true, this.ie10_6);
    assert.equal(unsupported, false);
  });

  it('should NOT be passed by #isUnsupportedBrowser for IE10.6 and for IE10 miminal version specified in strict mode', function() {
    var isUnsupported = browser.isUnsupportedBrowser({msie: "11"}, true, this.ie10_6);
    assert.equal(isUnsupported, true);
  });

  it('should NOT be passed by #check for IE10.6 and for IE11 miminal version specified', function() {
    var supported = browser.check({msie: "11"}, this.ie10_6);
    assert.equal(supported, false);
  });

  it('should NOT be passed by #check for IE10.6 and for IE11 miminal version specified in strict mode', function() {
    var supported = browser.check({msie: "11"}, true, this.ie10_6);
    assert.equal(supported, false);
  });

  it('should throw an error when minVersion map has a number, but not a string', function() {
    assert.throws(() => {
      browser.check({msie: 11}, this.ie10_6);
    }, /Browser version in the minVersion map should be a string/);
  });

  it('should be passed by #check for IE10.6 when version was not specified', function() {
    var supported = browser.check({}, this.ie10_6);
    assert.equal(supported, true);
  });

  it('should NOT be passed by #check for IE10.6 when version was not specified in strict mode', function() {
    var supported = browser.check({}, true, this.ie10_6);
    assert.equal(supported, false);
  });

})
