/*


*/

var moment = require('moment');

var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;
var util  = require('../../utils/EN');

var PATTERN = new RegExp('(\\W|^)' +
        '(?:on\\s*?)?' +
        '(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)\\s*,?\\s*)?' +
        '(([0-9]{1,2})(?:st|nd|rd|th)?|' + util.ORDINAL_WORDS_PATTERN + ')' +
        '(?:\\s*' +
            '(?:to|\\-|\\–|until|through|till|\\s)\\s*' +
            '(([0-9]{1,2})(?:st|nd|rd|th)?|' + util.ORDINAL_WORDS_PATTERN + ')' +
        ')?' + 
        '(?:-|\/|\\s*(?:of)?\\s*)' +
        '(' + util.MONTH_PATTERN + ')' +
        '(?:' +
            '(?:-|\/|,?\\s*)' +
            '((?:' + 
                '[1-9][0-9]{0,3}\\s*(?:BE|AD|BC)|' +
                '[1-2][0-9]{3}' + 
            ')(?![^\\s]\\d))' +
        ')?' +
        '(?=\\W|$)', 'i'
    );

var WEEKDAY_GROUP = 2;
var DATE_GROUP = 3;
var DATE_NUM_GROUP = 4;
var DATE_TO_GROUP = 5;
var DATE_TO_NUM_GROUP = 6;
var MONTH_NAME_GROUP = 7;
var YEAR_GROUP = 8;

exports.Parser = function ENMonthNameLittleEndianParser(){
    Parser.apply(this, arguments);

    this.pattern = function() { return PATTERN; }

    this.extract = function(text, ref, match, opt){

        var result = new ParsedResult({
            text: match[0].substr(match[1].length, match[0].length - match[1].length),
            index: match.index + match[1].length,
            ref: ref
        });

        var month = match[MONTH_NAME_GROUP];
        month = util.MONTH_OFFSET[month.toLowerCase()];

        var day = match[DATE_NUM_GROUP] ?
            parseInt(match[DATE_NUM_GROUP]):
            util.ORDINAL_WORDS[match[DATE_GROUP].trim().replace('-', ' ').toLowerCase()];

        var year = null;
        if (match[YEAR_GROUP]) {
            year = match[YEAR_GROUP];
            
            if (/BE/i.test(year)) {
                // Buddhist Era
                year = year.replace(/BE/i, '');
                year = parseInt(year) - 543;
            } else if (/BC/i.test(year)){
                // Before Christ
                year = year.replace(/BC/i, '');
                year = -parseInt(year);
            } else if (/AD/i.test(year)){
                year = year.replace(/AD/i, '');
                year = parseInt(year);
            } else {
                year = parseInt(year);
                if (year < 100){
                    year = year + 2000;
                }
            }
        }

        if(year){
            result.start.assign('day', day);
            result.start.assign('month', month);
            result.start.assign('year', year);
        } else {

            //Find the most appropriated year
            var refMoment = moment(ref);
            refMoment.month(month - 1);
            refMoment.date(day);
            refMoment.year(moment(ref).year());

            var nextYear = refMoment.clone().add(1, 'y');
            var lastYear = refMoment.clone().add(-1, 'y');
            if( Math.abs(nextYear.diff(moment(ref))) < Math.abs(refMoment.diff(moment(ref))) ){
                refMoment = nextYear;
            }
            else if( Math.abs(lastYear.diff(moment(ref))) < Math.abs(refMoment.diff(moment(ref))) ){
                refMoment = lastYear;
            }

            result.start.assign('day', day);
            result.start.assign('month', month);
            result.start.imply('year', refMoment.year());
        }

        // Weekday component
        if (match[WEEKDAY_GROUP]) {
            var weekday = match[WEEKDAY_GROUP];
            weekday = util.WEEKDAY_OFFSET[weekday.toLowerCase()]
            result.start.assign('weekday', weekday);
        }

        // Text can be 'range' value. Such as '12 - 13 January 2012'
        if (match[DATE_TO_GROUP]) {
            var endDate = match[DATE_TO_NUM_GROUP] ?
                parseInt(match[DATE_TO_NUM_GROUP]):
                util.ORDINAL_WORDS[match[DATE_TO_GROUP].trim().replace('-', ' ').toLowerCase()];

            result.end = result.start.clone();
            result.end.assign('day', endDate);
        }

        result.tags['ENMonthNameLittleEndianParser'] = true;
        return result;
    };
};
