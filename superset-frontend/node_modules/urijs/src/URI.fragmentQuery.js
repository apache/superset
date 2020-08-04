/*
 * Extending URI.js for fragment abuse
 */

// --------------------------------------------------------------------------------
// EXAMPLE: storing application/x-www-form-urlencoded data in the fragment
// possibly helpful for Google's hashbangs
// see http://code.google.com/web/ajaxcrawling/
// --------------------------------------------------------------------------------

// Note: make sure this is the last file loaded!

// USAGE:
// var uri = URI("http://example.org/#?foo=bar");
// uri.fragment(true) === {foo: "bar"};
// uri.fragment({bar: "foo"});
// uri.toString() === "http://example.org/#?bar=foo";
// uri.addFragment("name", "value");
// uri.toString() === "http://example.org/#?bar=foo&name=value";
// uri.removeFragment("name");
// uri.toString() === "http://example.org/#?bar=foo";
// uri.setFragment("name", "value1");
// uri.toString() === "http://example.org/#?bar=foo&name=value1";
// uri.setFragment("name", "value2");
// uri.toString() === "http://example.org/#?bar=foo&name=value2";

(function (root, factory) {
  'use strict';
  // https://github.com/umdjs/umd/blob/master/returnExports.js
  if (typeof module === 'object' && module.exports) {
    // Node
    module.exports = factory(require('./URI'));
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['./URI'], factory);
  } else {
    // Browser globals (root is window)
    factory(root.URI);
  }
}(this, function (URI) {
  'use strict';

  var p = URI.prototype;
  // old fragment handler we need to wrap
  var f = p.fragment;

  // make fragmentPrefix configurable
  URI.fragmentPrefix = '?';
  var _parts = URI._parts;
  URI._parts = function() {
    var parts = _parts();
    parts.fragmentPrefix = URI.fragmentPrefix;
    return parts;
  };
  p.fragmentPrefix = function(v) {
    this._parts.fragmentPrefix = v;
    return this;
  };

  // add fragment(true) and fragment({key: value}) signatures
  p.fragment = function(v, build) {
    var prefix = this._parts.fragmentPrefix;
    var fragment = this._parts.fragment || '';

    if (v === true) {
      if (fragment.substring(0, prefix.length) !== prefix) {
        return {};
      }

      return URI.parseQuery(fragment.substring(prefix.length));
    } else if (v !== undefined && typeof v !== 'string') {
      this._parts.fragment = prefix + URI.buildQuery(v);
      this.build(!build);
      return this;
    } else {
      return f.call(this, v, build);
    }
  };
  p.addFragment = function(name, value, build) {
    var prefix = this._parts.fragmentPrefix;
    var data = URI.parseQuery((this._parts.fragment || '').substring(prefix.length));
    URI.addQuery(data, name, value);
    this._parts.fragment = prefix + URI.buildQuery(data);
    if (typeof name !== 'string') {
      build = value;
    }

    this.build(!build);
    return this;
  };
  p.removeFragment = function(name, value, build) {
    var prefix = this._parts.fragmentPrefix;
    var data = URI.parseQuery((this._parts.fragment || '').substring(prefix.length));
    URI.removeQuery(data, name, value);
    this._parts.fragment = prefix + URI.buildQuery(data);
    if (typeof name !== 'string') {
      build = value;
    }

    this.build(!build);
    return this;
  };
  p.setFragment = function(name, value, build) {
    var prefix = this._parts.fragmentPrefix;
    var data = URI.parseQuery((this._parts.fragment || '').substring(prefix.length));
    URI.setQuery(data, name, value);
    this._parts.fragment = prefix + URI.buildQuery(data);
    if (typeof name !== 'string') {
      build = value;
    }

    this.build(!build);
    return this;
  };
  p.addHash = p.addFragment;
  p.removeHash = p.removeFragment;
  p.setHash = p.setFragment;

  // extending existing object rather than defining something new
  return URI;
}));
