'use strict';

var svgReg = /<svg[^>]+[^>]*>/;
function isSVG (buffer) {
  return svgReg.test(buffer);
}

var extractorRegExps = {
  'root': /<svg\s[^>]+>/,
  'width': /\bwidth=(['"])([^%]+?)\1/,
  'height': /\bheight=(['"])([^%]+?)\1/,
  'viewbox': /\bviewBox=(['"])(.+?)\1/
};

function parseViewbox (viewbox) {
  var bounds = viewbox.split(' ');
  return {
    'width': parseInt(bounds[2], 10),
    'height': parseInt(bounds[3], 10)
  };
}

function parseAttributes (root) {
  var width = root.match(extractorRegExps.width);
  var height = root.match(extractorRegExps.height);
  var viewbox = root.match(extractorRegExps.viewbox);
  return {
    'width': width && parseInt(width[2], 10),
    'height': height && parseInt(height[2], 10),
    'viewbox': viewbox && parseViewbox(viewbox[2])
  };
}

function calculateByDimensions (attrs) {
  return {
    'width': attrs.width,
    'height': attrs.height
  };
}

function calculateByViewbox (attrs) {
  var ratio = attrs.viewbox.width / attrs.viewbox.height;
  if (attrs.width) {
    return {
      'width': attrs.width,
      'height': Math.floor(attrs.width / ratio)
    };
  }
  if (attrs.height) {
    return {
      'width': Math.floor(attrs.height * ratio),
      'height': attrs.height
    };
  }
  return {
    'width': attrs.viewbox.width,
    'height': attrs.viewbox.height
  };
}

function calculate (buffer) {
  var root = buffer.toString('utf8').match(extractorRegExps.root);
  if (root) {
    var attrs = parseAttributes(root[0]);
    if (attrs.width && attrs.height) {
      return calculateByDimensions(attrs);
    }
    if (attrs.viewbox) {
      return calculateByViewbox(attrs);
    }
  }
  throw new TypeError('invalid svg');
}

module.exports = {
  'detect': isSVG,
  'calculate': calculate
};
