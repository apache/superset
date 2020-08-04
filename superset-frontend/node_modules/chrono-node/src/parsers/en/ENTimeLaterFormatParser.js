var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;
var util  = require('../../utils/EN');

var PATTERN = new RegExp('' +
    /*match[1]*/ '(\\W|^)' +
    /*match[2]*/ '(in )?' +
    /*match[3]*/ '(' + util.TIME_UNIT_PATTERN + ')' +
    /*match[4]*/ '(later|after|from now|henceforth|forward|out)?' +
    /*match[5]*/ '(?=(?:\\W|$))',
'i');

var STRICT_PATTERN = new RegExp('' +
    /*match[1]*/ '(\\W|^)' +
    /*match[2]*/ '(in )?' +
    /*match[3]*/ '(' + util.TIME_UNIT_STRICT_PATTERN + ')' +
    /*match[4]*/ '(later|from now)?' +
    /*match[5]*/ '(?=(?:\\W|$))',
'i');

exports.Parser = function ENTimeLaterFormatParser(){
    Parser.apply(this, arguments);

    this.pattern = function() {
        return this.isStrictMode()? STRICT_PATTERN : PATTERN;
    };

    this.extract = function(text, ref, match, opt){
        if (match.index > 0 && text[match.index-1].match(/\w/)) return null;

        var prefix = match[2];
        var suffix = match[4];
        if (!prefix && !suffix) return null;

        var preamble = match[1];
        
        var text = match[0];
        text  = match[0].substr(preamble.length, match[0].length - preamble.length);
        index = match.index + preamble.length;

        var result = new ParsedResult({
            index: index,
            text: text,
            ref: ref
        });

        var fragments = util.extractDateTimeUnitFragments(match[3]);
        var date = moment(ref);
        for (var key in fragments) {
            date.add(fragments[key], key);
        }

        if (fragments['hour'] > 0 || fragments['minute'] > 0 || fragments['second'] > 0) {
            result.start.assign('hour', date.hour());
            result.start.assign('minute', date.minute());
            result.start.assign('second', date.second());
            result.tags['ENTimeAgoFormatParser'] = true;
        } 
        
        if (fragments['d'] > 0 || fragments['month'] > 0 || fragments['year'] > 0) {
            result.start.assign('day', date.date());
            result.start.assign('month', date.month() + 1);
            result.start.assign('year', date.year());
        } else {
            if (fragments['week'] > 0) {
                result.start.imply('weekday', date.day());
            }

            result.start.imply('day', date.date());
            result.start.imply('month', date.month() + 1);
            result.start.imply('year', date.year());
        }

        return result;
    };
}
