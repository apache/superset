/*
    
    The parser for parsing month name and year.
    
    EX. 
        - Januar
        - Januar 2012
*/

var moment = require('moment');

var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;
var util  = require('../../utils/DE');

var PATTERN = new RegExp('(^|\\D\\s+|[^\\w\\s])' +
    '(Jan\\.?|Januar|Feb\\.?|Februar|Mär\\.?|M(?:ä|ae)rz|Mrz\\.?|Apr\\.?|April|Mai\\.?|Jun\\.?|Juni|Jul\\.?|Juli|Aug\\.?|August|Sep\\.?|Sept\\.?|September|Okt\\.?|Oktober|Nov\\.?|November|Dez\\.?|Dezember)' + 
    '\\s*' +
    '(?:' +
        ',?\\s*(?:([0-9]{4})(\\s*[vn]\\.?\\s*C(?:hr)?\\.?)?|([0-9]{1,4})\\s*([vn]\\.?\\s*C(?:hr)?\\.?))' +
    ')?' +
    '(?=[^\\s\\w]|$)', 'i');

var MONTH_NAME_GROUP = 2;
var YEAR_GROUP = 3;
var YEAR_BE_GROUP = 4;
var YEAR_GROUP2 = 5;
var YEAR_BE_GROUP2 = 6;

exports.Parser = function ENMonthNameParser(){
    Parser.apply(this, arguments);

    this.pattern = function() { return PATTERN; }
    
    this.extract = function(text, ref, match, opt){
        var result = new ParsedResult({
            text: match[0].substr(match[1].length, match[0].length - match[1].length),
            index: match.index + match[1].length,
            ref: ref,
        });

        
        var month = match[MONTH_NAME_GROUP];
        month = util.MONTH_OFFSET[month.toLowerCase()];

        var day = 1;

        var year = null;
        if (match[YEAR_GROUP] || match[YEAR_GROUP2]) {
            year = match[YEAR_GROUP] || match[YEAR_GROUP2];
            year = parseInt(year);

            if (match[YEAR_BE_GROUP] || match[YEAR_BE_GROUP2]) {
                if (/v/i.test(match[YEAR_BE_GROUP] || match[YEAR_BE_GROUP2])) {
                    // v.Chr.
                    year = -year;
                }

            } else if (year < 100){ 

                year = year + 2000;
            }
        }

        if(year){
            result.start.imply('day', day);
            result.start.assign('month', month);
            result.start.assign('year', year);
        } else {
            
            //Find the most appropriated year
            var refMoment = moment(ref);
            refMoment.month(month - 1);
            refMoment.date(day);

            var nextYear = refMoment.clone().add(1, 'y');
            var lastYear = refMoment.clone().add(-1, 'y');
            if( Math.abs(nextYear.diff(moment(ref))) < Math.abs(refMoment.diff(moment(ref))) ){  
                refMoment = nextYear;
            }
            else if( Math.abs(lastYear.diff(moment(ref))) < Math.abs(refMoment.diff(moment(ref))) ){ 
                refMoment = lastYear;
            }

            result.start.imply('day', day);
            result.start.assign('month', month);
            result.start.imply('year', refMoment.year());
        }

        result.tags['DEMonthNameParser'] = true;
        return result;
    }
}

