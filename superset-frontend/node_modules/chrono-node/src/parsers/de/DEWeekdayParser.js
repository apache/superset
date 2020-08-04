/*


*/
var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;

var DAYS_OFFSET = {
    'sonntag': 0, 'so': 0,
    'montag': 1, 'mo': 1,
    'dienstag': 2, 'di': 2,
    'mittwoch': 3, 'mi': 3,
    'donnerstag': 4, 'do': 4,
    'freitag': 5, 'fr': 5,
    'samstag': 6, 'sa': 6
};

var PATTERN = new RegExp('(\\W|^)' +
    '(?:(?:\\,|\\(|\\（)\\s*)?' +
    '(?:a[mn]\\s*?)?' +
    '(?:(diese[mn]|letzte[mn]|n(?:ä|ae)chste[mn])\\s*)?' +
    '(' + Object.keys(DAYS_OFFSET).join('|') + ')' +
    '(?:\\s*(?:\\,|\\)|\\）))?' +
    '(?:\\s*(diese|letzte|n(?:ä|ae)chste)\\s*woche)?' +
    '(?=\\W|$)', 'i');

var PREFIX_GROUP = 2;
var WEEKDAY_GROUP = 3;
var POSTFIX_GROUP = 4;

exports.Parser = function DEWeekdayParser() {
    Parser.apply(this, arguments);

    this.pattern = function() { return PATTERN; };

    this.extract = function(text, ref, match, opt){
        var index = match.index + match[1].length;
        var text = match[0].substr(match[1].length, match[0].length - match[1].length);
        var result = new ParsedResult({
            index: index,
            text: text,
            ref: ref,
        });

        var dayOfWeek = match[WEEKDAY_GROUP].toLowerCase();
        var offset = DAYS_OFFSET[dayOfWeek];
        if(offset === undefined) return null;

        var startMoment = moment(ref);
        var prefix = match[PREFIX_GROUP];
        var postfix = match[POSTFIX_GROUP];

        var refOffset = startMoment.day();
        var norm = prefix || postfix;
        norm = norm || '';
        norm = norm.toLowerCase();
        if (/letzte/.test(norm)) {
            startMoment.day(offset - 7);
        } else if (/n(?:ä|ae)chste/.test(norm)) {
            startMoment.day(offset + 7);
        } else if (/diese/.test(norm)) {
            if ( opt.forwardDate && refOffset > offset ) {
                startMoment.day(offset + 7);
            } else {
                startMoment.day(offset);
            }
        } else {
            if ( opt.forwardDate && refOffset > offset ) {
                startMoment.day(offset + 7);
            } else if (!opt.forwardDate && Math.abs(offset - 7 - refOffset) < Math.abs(offset - refOffset)) {
                startMoment.day(offset - 7);
            } else if (!opt.forwardDate && Math.abs(offset + 7 - refOffset) < Math.abs(offset - refOffset)) {
                startMoment.day(offset + 7);
            } else {
                startMoment.day(offset);
            }
        }

        result.start.assign('weekday', offset);
        result.start.imply('day', startMoment.date());
        result.start.imply('month', startMoment.month() + 1);
        result.start.imply('year', startMoment.year());
        return result;
    }
};
