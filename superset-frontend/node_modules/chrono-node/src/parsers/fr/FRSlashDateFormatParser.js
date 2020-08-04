/*
    Date format with slash "/" (also "-" and ".") between numbers
    - Martes 3/11/2015
    - 3/11/2015
    - 3/11
*/
var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;

var PATTERN = new RegExp('(\\W|^)' +
    '(?:' +
        '((?:dimanche|dim|lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|le))' +
        '\\s*\\,?\\s*' +
    ')?' +
    '([0-3]{0,1}[0-9]{1})[\\/\\.\\-]([0-3]{0,1}[0-9]{1})' +
    '(?:' +
        '[\\/\\.\\-]' +
        '([0-9]{4}\s*\,?\s*|[0-9]{2}\s*\,?\s*)' +
    ')?' +
    '(\\W|$)', 'i');

var DAYS_OFFSET = { 'dimanche': 0, 'dim': 0, 'lundi': 1, 'lun': 1,'mardi': 2, 'mar':2, 'mercredi': 3, 'mer': 3,
    'jeudi': 4, 'jeu':4, 'vendredi': 5, 'ven': 5,'samedi': 6, 'sam': 6};


var OPENNING_GROUP = 1;
var ENDING_GROUP = 6;

// In French we use day/month/year
var WEEKDAY_GROUP = 2;
var DAY_GROUP = 3;
var MONTH_GROUP = 4;
var YEAR_GROUP = 5;
var YEAR_BE_GROUP = 6;

exports.Parser = function FRSlashDateFormatParser(argument) {
    Parser.apply(this, arguments);

    this.pattern = function () { return PATTERN; };
    this.extract = function(text, ref, match, opt){

        if(match[OPENNING_GROUP] == '/' || match[ENDING_GROUP] == '/') {
            // Long skip, if there is some overlapping like:
            // XX[/YY/ZZ]
            // [XX/YY/]ZZ
            match.index += match[0].length
            return;
        }

        var index = match.index + match[OPENNING_GROUP].length;
        var text = match[0].substr(match[OPENNING_GROUP].length, match[0].length - match[ENDING_GROUP].length);


        var result = new ParsedResult({
            text: text,
            index: index,
            ref: ref,
        });

        if(text.match(/^\d\.\d$/)) return;
        if(text.match(/^\d\.\d{1,2}\.\d{1,2}$/)) return;

        // MM/dd -> OK
        // MM.dd -> NG
        if(!match[YEAR_GROUP] && match[0].indexOf('/') < 0) return;

        var date = null;
        var month = match[MONTH_GROUP];
        var day   = match[DAY_GROUP];

        day  = parseInt(day);
        month = parseInt(month);

        var year = null;
        if (match[YEAR_GROUP]) {
            year = match[YEAR_GROUP];
            year = parseInt(year);

            if(match[YEAR_BE_GROUP]){
                if (/a/i.test(match[YEAR_BE_GROUP])) {
                    // Ante Christe natum
                    year = -year;
                }
            } else if (year < 100){

                year = year + 2000;
            }
        }

        if(month < 1 || month > 12) {
            if(month > 12) {
                // dd/mm/yyyy date format if day looks like a month, and month looks like a day.
                if (day >= 1 && day <= 12 && month >= 13 && month <= 31) {
                    // unambiguous
                    var tday = month;
                    month = day;
                    day = tday;
                }
                else {
                    // both month and day are <= 12
                    return null;
                }
            }
        }

        if(day < 1 || day > 31) return null;

        if(year){
            result.start.assign('day', day);
            result.start.assign('month', month);
            result.start.assign('year', year);
        } else {

            // Find the most appropriated year
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

        // Day of week
        if(match[WEEKDAY_GROUP]) {
            result.start.assign('weekday', DAYS_OFFSET[match[WEEKDAY_GROUP].toLowerCase()]);
        }

        result.tags['FRSlashDateFormatParser'] = true;
        return result;
    };
};