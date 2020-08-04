/*


*/

var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;
var ParsedComponents = require('../../result').ParsedComponents;

var FIRST_REG_PATTERN  = new RegExp("(^|\\s|T)" +
    "(?:(?:[àa])\\s*)?" +
    "(\\d{1,2}(?:h)?|midi|minuit)" +
    "(?:" +
        "(?:\\.|\\:|\\：|h)(\\d{1,2})(?:m)?" +
        "(?:" +
            "(?:\\:|\\：|m)(\\d{0,2})(?:s)?" +
        ")?" +
    ")?" +
    "(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?" +
    "(?=\\W|$)", 'i');


var SECOND_REG_PATTERN = new RegExp("^\\s*" +
    "(\\-|\\–|\\~|\\〜|[àa]|\\?)\\s*" +
    "(\\d{1,2}(?:h)?)" +
    "(?:" +
        "(?:\\.|\\:|\\：|h)(\\d{1,2})(?:m)?" +
        "(?:" +
            "(?:\\.|\\:|\\：|m)(\\d{1,2})(?:s)?" +
        ")?" +
    ")?" +
    "(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?" +
    "(?=\\W|$)", 'i');

var HOUR_GROUP    = 2;
var MINUTE_GROUP  = 3;
var SECOND_GROUP  = 4;
var AM_PM_HOUR_GROUP = 5;

exports.Parser = function FRTimeExpressionParser(){
    Parser.apply(this, arguments);

    this.pattern = function() { return FIRST_REG_PATTERN; }

    this.extract = function(text, ref, match, opt){

        // This pattern can be overlaped Ex. [12] AM, 1[2] AM
        if (match.index > 0 && text[match.index-1].match(/\w/)) return null;
        var refMoment = moment(ref);
        var result = new ParsedResult();
        result.ref = ref;
        result.index = match.index + match[1].length;
        result.text  = match[0].substring(match[1].length);
        result.tags['FRTimeExpressionParser'] = true;

        result.start.imply('day',   refMoment.date());
        result.start.imply('month', refMoment.month()+1);
        result.start.imply('year',  refMoment.year());

        var hour = 0;
        var minute = 0;
        var meridiem = -1;

        // ----- Second
        if(match[SECOND_GROUP] != null){
            var second = parseInt(match[SECOND_GROUP]);
            if(second >= 60) return null;

            result.start.assign('second', second);
        }

        // ----- Hours
        if (match[HOUR_GROUP].toLowerCase() == "midi"){
            meridiem = 1;
            hour = 12;
        } else if (match[HOUR_GROUP].toLowerCase() == "minuit") {
            meridiem = 0;
            hour = 0;
        } else {
            hour = parseInt(match[HOUR_GROUP]);
        }

        // ----- Minutes
        if(match[MINUTE_GROUP] != null){
            minute = parseInt(match[MINUTE_GROUP]);
        } else if(hour > 100) {
            minute = hour%100;
            hour   = parseInt(hour/100);
        }

        if(minute >= 60) {
            return null;
        }

        if(hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }

        // ----- AM & PM
        if(match[AM_PM_HOUR_GROUP] != null) {
            if(hour > 12) return null;
            var ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
            if(ampm == "a"){
                meridiem = 0;
                if(hour == 12) hour = 0;
            }

            if(ampm == "p"){
                meridiem = 1;
                if(hour != 12) hour += 12;
            }
        }
        result.start.assign('hour', hour);
        result.start.assign('minute', minute);
        if (meridiem >= 0) {
            result.start.assign('meridiem', meridiem);
        }

        // ==============================================================
        //                  Extracting the 'to' chunk
        // ==============================================================
        match = SECOND_REG_PATTERN.exec(text.substring(result.index + result.text.length));
        if (!match) {
            // Not accept number only result
            if (result.text.match(/^\d+$/)) {
                return null;
            }
            return result;
        }



        // Pattern "YY.YY -XXXX" is more like timezone offset
        if (match[0].match(/^\s*(\+|\-)\s*\d{3,4}$/)) {
            return result;
        }

        if(result.end == null){
            result.end = new ParsedComponents(null, result.start.date());
        }

        var hour = 0;
        var minute = 0;
        var meridiem = -1;

        // ----- Second
        if(match[SECOND_GROUP] != null){
            var second = parseInt(match[SECOND_GROUP]);
            if(second >= 60) return null;

            result.end.assign('second', second);
        }

        hour = parseInt(match[2]);

        // ----- Minute
        if (match[MINUTE_GROUP]!= null) {

            minute = parseInt(match[MINUTE_GROUP]);
            if(minute >= 60) return result;

        } else if (hour > 100) {

            minute = hour%100;
            hour   = parseInt(hour/100);
        }

        if(minute >= 60) {
            return null;
        }

        if(hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }

        // ----- AM & PM
        if (match[AM_PM_HOUR_GROUP] != null){

            if (hour > 12) return null;

            if(match[AM_PM_HOUR_GROUP][0].toLowerCase() == "a"){
                meridiem = 0;
                if(hour == 12) {
                    hour = 0;
                    if (!result.end.isCertain('day')) {
                        result.end.imply('day', result.end.get('day') + 1);
                    }
                }
            }

            if(match[AM_PM_HOUR_GROUP][0].toLowerCase() == "p"){
                meridiem = 1;
                if(hour != 12) hour += 12;
            }

            if (!result.start.isCertain('meridiem')) {
                if (meridiem == 0) {

                    result.start.imply('meridiem', 0);

                    if (result.start.get('hour') == 12) {
                        result.start.assign('hour', 0);
                    }

                } else {

                    result.start.imply('meridiem', 1);

                    if (result.start.get('hour') != 12) {
                        result.start.assign('hour', result.start.get('hour') + 12);
                    }
                }
            }

        } else if(hour >= 12) {
            meridiem = 1;
        }

        result.text = result.text + match[0];
        result.end.assign('hour', hour);
        result.end.assign('minute', minute);
        if (meridiem >= 0) {
            result.end.assign('meridiem', meridiem);
        }

        if (result.end.date().getTime() < result.start.date().getTime()) {
            result.end.imply('day', result.end.get('day') + 1)
        }

        return result;
    }
}
