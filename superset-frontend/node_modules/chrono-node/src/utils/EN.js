exports.WEEKDAY_OFFSET = { 
    'sunday': 0, 
    'sun': 0, 
    'monday': 1, 
    'mon': 1,
    'tuesday': 2, 
    'tue':2, 
    'wednesday': 3, 
    'wed': 3, 
    'thursday': 4, 
    'thur': 4, 
    'thu': 4,
    'friday': 5, 
    'fri': 5,
    'saturday': 6, 
    'sat': 6
};
    
exports.MONTH_OFFSET = { 
    'january': 1,
    'jan': 1,
    'jan.': 1,
    'february': 2,
    'feb': 2,
    'feb.': 2,
    'march': 3,
    'mar': 3,
    'mar.': 3,
    'april': 4,
    'apr': 4,
    'apr.': 4,
    'may': 5,
    'june': 6,
    'jun': 6,
    'jun.': 6,
    'july': 7,
    'jul': 7,
    'jul.': 7,
    'august': 8,
    'aug': 8,
    'aug.': 8,
    'september': 9,
    'sep': 9,
    'sep.': 9,
    'sept': 9,
    'sept.': 9,
    'october': 10,
    'oct': 10,
    'oct.': 10,
    'november': 11,
    'nov': 11,
    'nov.': 11,
    'december': 12,
    'dec': 12,
    'dec.': 12
};

exports.MONTH_PATTERN = '(?:' 
    + Object.keys(exports.MONTH_OFFSET).join('|').replace(/\./g, '\\.')
    + ')';

exports.INTEGER_WORDS = {
    'one' : 1,
    'two' : 2,
    'three' : 3,
    'four' : 4,
    'five' : 5,
    'six' : 6,
    'seven' : 7,
    'eight' : 8,
    'nine' : 9,
    'ten' : 10,
    'eleven' : 11,
    'twelve' : 12
};
exports.INTEGER_WORDS_PATTERN = '(?:' 
    + Object.keys(exports.INTEGER_WORDS).join('|') 
    +')';

exports.ORDINAL_WORDS = {
    'first' : 1,
    'second': 2,
    'third': 3,
    'fourth': 4,
    'fifth': 5,
    'sixth': 6,
    'seventh': 7,
    'eighth': 8,
    'ninth': 9,
    'tenth': 10,
    'eleventh': 11,
    'twelfth': 12,
    'thirteenth': 13,
    'fourteenth': 14,
    'fifteenth': 15,
    'sixteenth': 16,
    'seventeenth': 17,
    'eighteenth': 18,
    'nineteenth': 19,
    'twentieth': 20,
    'twenty first': 21,
    'twenty second': 22,
    'twenty third': 23,
    'twenty fourth': 24,
    'twenty fifth': 25,
    'twenty sixth': 26,
    'twenty seventh': 27,
    'twenty eighth': 28,
    'twenty ninth': 29,
    'thirtieth': 30,
    'thirty first': 31
};
exports.ORDINAL_WORDS_PATTERN = '(?:' 
    + Object.keys(exports.ORDINAL_WORDS).join('|').replace(/ /g, '[ -]') 
    + ')';

var TIME_UNIT = 
    '(' + exports.INTEGER_WORDS_PATTERN + '|[0-9]+|[0-9]+\.[0-9]+|an?(?:\\s*few)?|half(?:\\s*an?)?)\\s*' +
    '(sec(?:onds?)?|min(?:ute)?s?|hours?|weeks?|days?|months?|years?)\\s*';

var TIME_UNIT_STRICT = 
    '(?:[0-9]+|an?)\\s*' +
    '(?:seconds?|minutes?|hours?|days?)\\s*';

var PATTERN_TIME_UNIT = new RegExp(TIME_UNIT, 'i');

exports.TIME_UNIT_PATTERN = '(?:' + TIME_UNIT + ')+';
exports.TIME_UNIT_STRICT_PATTERN = '(?:' + TIME_UNIT_STRICT + ')+';

exports.extractDateTimeUnitFragments = function (timeunitText) {
    var fragments = {};
    var remainingText = timeunitText;
    var match = PATTERN_TIME_UNIT.exec(remainingText);
    while (match) {
        collectDateTimeFragment(match, fragments);
        remainingText = remainingText.substring(match[0].length);
        match = PATTERN_TIME_UNIT.exec(remainingText);
    }
    return fragments;
};

function collectDateTimeFragment(match, fragments) {
    var num = match[1].toLowerCase() ;
    if (exports.INTEGER_WORDS[num] !== undefined) {
        num = exports.INTEGER_WORDS[num];
    } else if(num === 'a' || num === 'an'){
        num = 1;
    } else if (num.match(/few/)) {
        num = 3;
    } else if (num.match(/half/)) {
        num = 0.5;
    } else {
        num = parseFloat(num);
    }

    if (match[2].match(/hour/i)) {
        fragments['hour'] = num;
    } else if (match[2].match(/min/i)) {
        fragments['minute'] = num;
    } else if (match[2].match(/sec/i)) {
        fragments['second'] = num;
    } else if (match[2].match(/week/i)) {
        fragments['week'] = num;
    } else if (match[2].match(/day/i)) {
        fragments['d'] = num;
    } else if (match[2].match(/month/i)) {
        fragments['month'] = num;
    } else if (match[2].match(/year/i)) {
        fragments['year'] = num;
    }

    return fragments;
}