'use strict';

var names = require('../utils/names.js');

// https://www.w3.org/TR/css-values-3/#lengths
var LENGTH = {
    // absolute length units
    'px': true,
    'mm': true,
    'cm': true,
    'in': true,
    'pt': true,
    'pc': true,
    'q': true,

    // relative length units
    'em': true,
    'ex': true,
    'ch': true,
    'rem': true,

    // viewport-percentage lengths
    'vh': true,
    'vw': true,
    'vmin': true,
    'vmax': true,
    'vm': true
};

var ANGLE = {
    'deg': true,
    'grad': true,
    'rad': true,
    'turn': true
};

var TIME = {
    's': true,
    'ms': true
};

var FREQUENCY = {
    'hz': true,
    'khz': true
};

// https://www.w3.org/TR/css-values-3/#resolution (https://drafts.csswg.org/css-values/#resolution)
var RESOLUTION = {
    'dpi': true,
    'dpcm': true,
    'dppx': true,
    'x': true      // https://github.com/w3c/csswg-drafts/issues/461
};

// https://drafts.csswg.org/css-grid/#fr-unit
var FLEX = {
    'fr': true
};

// https://www.w3.org/TR/css3-speech/#mixing-props-voice-volume
var DECIBEL = {
    'db': true
};

// https://www.w3.org/TR/css3-speech/#voice-props-voice-pitch
var SEMITONES = {
    'st': true
};

// can be used wherever <length>, <frequency>, <angle>, <time>, <percentage>, <number>, or <integer> values are allowed
// https://drafts.csswg.org/css-values/#calc-notation
function isCalc(node) {
    if (node.data.type !== 'Function') {
        return false;
    }

    var keyword = names.keyword(node.data.name);

    // check the function name
    return (
        keyword.name === 'calc' ||
        keyword.name === '-moz-calc' ||
        keyword.name === '-webkit-calc'
    );
}

function astNode(type) {
    return function(node) {
        return node.data.type === type;
    };
}

function dimension(type) {
    return function(node) {
        return isCalc(node) ||
               (node.data.type === 'Dimension' && type.hasOwnProperty(node.data.unit.toLowerCase()));
    };
}

function zeroUnitlessDimension(type) {
    return function(node) {
        return isCalc(node) ||
               (node.data.type === 'Dimension' && type.hasOwnProperty(node.data.unit.toLowerCase())) ||
               (node.data.type === 'Number' && Number(node.data.value) === 0);
    };
}

function attr(node) {
    return node.data.type === 'Function' && node.data.name.toLowerCase() === 'attr';
}

function number(node) {
    return isCalc(node) || node.data.type === 'Number';
}

function numberZeroOne(node) {
    if (isCalc(node) || node.data.type === 'Number') {
        var value = Number(node.data.value);

        return value >= 0 && value <= 1;
    }

    return false;
}

function numberOneOrGreater(node) {
    if (isCalc(node) || node.data.type === 'Number') {
        return Number(node.data.value) >= 1;
    }

    return false;
}

// TODO: fail on 10e-2
function integer(node) {
    return isCalc(node) ||
           (node.data.type === 'Number' && node.data.value.indexOf('.') === -1);
}

// TODO: fail on 10e-2
function positiveInteger(node) {
    return isCalc(node) ||
           (node.data.type === 'Number' && node.data.value.indexOf('.') === -1 && node.data.value.charAt(0) !== '-');
}

function percentage(node) {
    return isCalc(node) ||
           node.data.type === 'Percentage';
}

function hexColor(node) {
    if (node.data.type !== 'HexColor') {
        return false;
    }

    var hex = node.data.value;

    return /^[0-9a-fA-F]{3,8}$/.test(hex) &&
           (hex.length === 3 || hex.length === 4 || hex.length === 6 || hex.length === 8);
}

function expression(node) {
    return node.data.type === 'Function' && node.data.name.toLowerCase() === 'expression';
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/custom-ident
// https://drafts.csswg.org/css-values-4/#identifier-value
function customIdent(node) {
    if (node.data.type !== 'Identifier') {
        return false;
    }

    var name = node.data.name.toLowerCase();

    // § 3.2. Author-defined Identifiers: the <custom-ident> type
    // The CSS-wide keywords are not valid <custom-ident>s
    if (name === 'unset' || name === 'initial' || name === 'inherit') {
        return false;
    }

    // The default keyword is reserved and is also not a valid <custom-ident>
    if (name === 'default') {
        return false;
    }

    // TODO: ignore property specific keywords (as described https://developer.mozilla.org/en-US/docs/Web/CSS/custom-ident)

    return true;
}

module.exports = {
    'angle': zeroUnitlessDimension(ANGLE),
    'attr()': attr,
    'custom-ident': customIdent,
    'decibel': dimension(DECIBEL),
    'dimension': astNode('Dimension'),
    'frequency': dimension(FREQUENCY),
    'flex': dimension(FLEX),
    'hex-color': hexColor,
    'id-selector': astNode('IdSelector'), // element( <id-selector> )
    'ident': astNode('Identifier'),
    'integer': integer,
    'length': zeroUnitlessDimension(LENGTH),
    'number': number,
    'number-zero-one': numberZeroOne,
    'number-one-or-greater': numberOneOrGreater,
    'percentage': percentage,
    'positive-integer': positiveInteger,
    'resolution': dimension(RESOLUTION),
    'semitones': dimension(SEMITONES),
    'string': astNode('String'),
    'time': dimension(TIME),
    'unicode-range': astNode('UnicodeRange'),
    'url': astNode('Url'),

    // old IE stuff
    'progid': astNode('Raw'),
    'expression': expression
};
