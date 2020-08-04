/*


*/

var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;

var PATTERN = /(\W|^)il y a\s*([0-9]+|une?)\s*(minutes?|heures?|semaines?|jours?|mois|années?|ans?)(?=(?:\W|$))/i;

exports.Parser = function FRTimeAgoFormatParser(){
    Parser.apply(this, arguments);

    this.pattern = function() {
        return PATTERN;
    }

    this.extract = function(text, ref, match, opt){

        if (match.index > 0 && text[match.index-1].match(/\w/)) return null;

        var text = match[0];
        text  = match[0].substr(match[1].length, match[0].length - match[1].length);
        index = match.index + match[1].length;

        var result = new ParsedResult({
            index: index,
            text: text,
            ref: ref,
        });
        result.tags['FRTimeAgoFormatParser'] = true;
        
        var num = parseInt(match[2]);
        if (isNaN(num)) {
          if (match[2].match(/demi/)) {
            num = 0.5;
          } else {
            num = 1;
          }
        }

        var date = moment(ref);

        if (match[3].match(/heure/) || match[3].match(/minute/)) {
            if (match[3].match(/heure/)) {

                date.add(-num, 'hour');

            } else if (match[3].match(/minute/)) {

                date.add(-num, 'minute');
            }

            result.start.imply('day', date.date());
            result.start.imply('month', date.month() + 1);
            result.start.imply('year', date.year());
            result.start.assign('hour', date.hour());
            result.start.assign('minute', date.minute());

            return result;
        }

        if (match[3].match(/semaine/)) {
            date.add(-num, 'week');

            result.start.imply('day', date.date());
            result.start.imply('month', date.month() + 1);
            result.start.imply('year', date.year());
            result.start.imply('weekday', date.day());
            return result;
        }

        if (match[3].match(/jour/)) {
            date.add(-num, 'd');
        }

        if (match[3].match(/mois/)) {
            date.add(-num, 'month');
        }

        if (match[3].match(/années?|ans?/)) {

            date.add(-num, 'year');
        }

        result.start.assign('day', date.date());
        result.start.assign('month', date.month() + 1);
        result.start.assign('year', date.year());
        return result;

    };
}
