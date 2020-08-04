/*


*/

var moment = require('moment');
var Parser = require('../parser').Parser;
var ParsedResult = require('../../result').ParsedResult;
var ParsedComponents = require('../../result').ParsedComponents;

var util = require('../../utils/ZH-Hant.js');

var patternString1 = '(?:由|從|自)?' +
    '(?:' +
    '(今|明|前|大前|後|大後|聽|昨|尋|琴)(早|朝|晚)|' +
    '(上(?:午|晝)|朝(?:早)|早(?:上)|下(?:午|晝)|晏(?:晝)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨))|' +
    '(今|明|前|大前|後|大後|聽|昨|尋|琴)(?:日|天)' +
    '(?:[\\s,，]*)' +
    '(?:(上(?:午|晝)|朝(?:早)|早(?:上)|下(?:午|晝)|晏(?:晝)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨)))?' +
    ')?' +
    '(?:[\\s,，]*)' +
    '(?:(\\d+|[' + Object.keys(util.NUMBER).join('') + ']+)(?:\\s*)(?:點|時|:|：)' +
    '(?:\\s*)' +
    '(\\d+|半|正|整|[' + Object.keys(util.NUMBER).join('') + ']+)?(?:\\s*)(?:分|:|：)?' +
    '(?:\\s*)' +
    '(\\d+|[' + Object.keys(util.NUMBER).join('') + ']+)?(?:\\s*)(?:秒)?)' +
    '(?:\\s*(A\.M\.|P\.M\.|AM?|PM?))?';

var patternString2 = '(?:\\s*(?:到|至|\\-|\\–|\\~|\\〜)\\s*)' +
    '(?:' +
    '(今|明|前|大前|後|大後|聽|昨|尋|琴)(早|朝|晚)|' +
    '(上(?:午|晝)|朝(?:早)|早(?:上)|下(?:午|晝)|晏(?:晝)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨))|' +
    '(今|明|前|大前|後|大後|聽|昨|尋|琴)(?:日|天)' +
    '(?:[\\s,，]*)' +
    '(?:(上(?:午|晝)|朝(?:早)|早(?:上)|下(?:午|晝)|晏(?:晝)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨)))?' +
    ')?' +
    '(?:[\\s,，]*)' +
    '(?:(\\d+|[' + Object.keys(util.NUMBER).join('') + ']+)(?:\\s*)(?:點|時|:|：)' +
    '(?:\\s*)' +
    '(\\d+|半|正|整|[' + Object.keys(util.NUMBER).join('') + ']+)?(?:\\s*)(?:分|:|：)?' +
    '(?:\\s*)' +
    '(\\d+|[' + Object.keys(util.NUMBER).join('') + ']+)?(?:\\s*)(?:秒)?)' +
    '(?:\\s*(A\.M\.|P\.M\.|AM?|PM?))?';

var FIRST_REG_PATTERN = new RegExp(patternString1, 'i');
var SECOND_REG_PATTERN = new RegExp(patternString2, 'i');

var DAY_GROUP_1 = 1;
var ZH_AM_PM_HOUR_GROUP_1 = 2;
var ZH_AM_PM_HOUR_GROUP_2 = 3;
var DAY_GROUP_3 = 4;
var ZH_AM_PM_HOUR_GROUP_3 = 5;
var HOUR_GROUP = 6;
var MINUTE_GROUP = 7;
var SECOND_GROUP = 8;
var AM_PM_HOUR_GROUP = 9;

exports.Parser = function ZHHantTimeExpressionParser() {

    Parser.apply(this, arguments);

    this.pattern = function() {
        return FIRST_REG_PATTERN;
    };

    this.extract = function(text, ref, match, opt) {

        // This pattern can be overlaped Ex. [12] AM, 1[2] AM
        if (match.index > 0 && text[match.index - 1].match(/\w/)) return null;
        var refMoment = moment(ref);
        var result = new ParsedResult();
        result.ref = ref;
        result.index = match.index;
        result.text = match[0];
        result.tags.ZHTimeExpressionParser = true;

        var startMoment = refMoment.clone();

        // ----- Day
        if (match[DAY_GROUP_1]) {
            var day1 = match[DAY_GROUP_1];
            if (day1 == '明' || day1 == '聽') {
              // Check not "Tomorrow" on late night
              if(refMoment.hour() > 1) {
                  startMoment.add(1, 'day');
              }
            } else if (day1 == '昨' || day1 == '尋' || day1 == '琴') {
                startMoment.add(-1, 'day');
            } else if (day1 == "前"){
                startMoment.add(-2, 'day');
            } else if (day1 == "大前"){
                startMoment.add(-3, 'day');
            } else if (day1 == "後"){
                startMoment.add(2, 'day');
            } else if (day1 == "大後"){
                startMoment.add(3, 'day');
            }
            result.start.assign('day', startMoment.date());
            result.start.assign('month', startMoment.month() + 1);
            result.start.assign('year', startMoment.year());
        } else if (match[DAY_GROUP_3]) {
            var day3 = match[DAY_GROUP_3];
            if (day3 == '明' || day3 == '聽') {
                startMoment.add(1, 'day');
            } else if (day3 == '昨' || day3 == '尋' || day3 == '琴') {
                startMoment.add(-1, 'day');
            } else if (day3 == "前"){
                startMoment.add(-2, 'day');
            } else if (day3 == "大前"){
                startMoment.add(-3, 'day');
            } else if (day3 == "後"){
                startMoment.add(2, 'day');
            } else if (day3 == "大後"){
                startMoment.add(3, 'day');
            }
            result.start.assign('day', startMoment.date());
            result.start.assign('month', startMoment.month() + 1);
            result.start.assign('year', startMoment.year());
        } else {
            result.start.imply('day', startMoment.date());
            result.start.imply('month', startMoment.month() + 1);
            result.start.imply('year', startMoment.year());
        }

        var hour = 0;
        var minute = 0;
        var meridiem = -1;

        // ----- Second
        if (match[SECOND_GROUP]) {
            var second = parseInt(match[SECOND_GROUP]);
            if (isNaN(second)) {
                second = util.zhStringToNumber(match[SECOND_GROUP]);
            }
            if (second >= 60) return null;
            result.start.assign('second', second);
        }

        hour = parseInt(match[HOUR_GROUP]);
        if (isNaN(hour)) {
            hour = util.zhStringToNumber(match[HOUR_GROUP]);
        }

        // ----- Minutes
        if (match[MINUTE_GROUP]) {
            if (match[MINUTE_GROUP] == '半') {
                minute = 30;
            } else if (match[MINUTE_GROUP] == '正' || match[MINUTE_GROUP] == '整') {
                minute = 0;
            } else {
                minute = parseInt(match[MINUTE_GROUP]);
                if (isNaN(minute)) {
                    minute = util.zhStringToNumber(match[MINUTE_GROUP]);
                }
            }
        } else if (hour > 100) {
            minute = hour % 100;
            hour = parseInt(hour / 100);
        }

        if (minute >= 60) {
            return null;
        }

        if (hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }

        // ----- AM & PM
        if (match[AM_PM_HOUR_GROUP]) {
            if (hour > 12) return null;
            var ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
            if (ampm == "a") {
                meridiem = 0;
                if (hour == 12) hour = 0;
            }

            if (ampm == "p") {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        } else if (match[ZH_AM_PM_HOUR_GROUP_1]) {
            var zhAMPMString1 = match[ZH_AM_PM_HOUR_GROUP_1];
            var zhAMPM1 = zhAMPMString1[0];
            if (zhAMPM1 == '朝' || zhAMPM1 == '早') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM1 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        } else if (match[ZH_AM_PM_HOUR_GROUP_2]) {
            var zhAMPMString2 = match[ZH_AM_PM_HOUR_GROUP_2];
            var zhAMPM2 = zhAMPMString2[0];
            if (zhAMPM2 == '上' || zhAMPM2 == '朝' || zhAMPM2 == '早' || zhAMPM2 == '凌') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM2 == '下' || zhAMPM2 == '晏' || zhAMPM2 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        } else if (match[ZH_AM_PM_HOUR_GROUP_3]) {
            var zhAMPMString3 = match[ZH_AM_PM_HOUR_GROUP_3];
            var zhAMPM3 = zhAMPMString3[0];
            if (zhAMPM3 == '上' || zhAMPM3 == '朝' || zhAMPM3 == '早' || zhAMPM3 == '凌') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM3 == '下' || zhAMPM3 == '晏' || zhAMPM3 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        }

        result.start.assign('hour', hour);
        result.start.assign('minute', minute);

        if (meridiem >= 0) {
            result.start.assign('meridiem', meridiem);
        } else {
            if (hour < 12) {
                result.start.imply('meridiem', 0);
            } else {
                result.start.imply('meridiem', 1);
            }
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

        var endMoment = startMoment.clone();
        result.end = new ParsedComponents(null, null);

        // ----- Day
        if (match[DAY_GROUP_1]) {
            var day1 = match[DAY_GROUP_1];
            if (day1 == '明' || day1 == '聽') {
              // Check not "Tomorrow" on late night
              if(refMoment.hour() > 1) {
                  endMoment.add(1, 'day');
              }
            } else if (day1 == '昨' || day1 == '尋' || day1 == '琴') {
                endMoment.add(-1, 'day');
            } else if (day1 == "前"){
                endMoment.add(-2, 'day');
            } else if (day1 == "大前"){
                endMoment.add(-3, 'day');
            } else if (day1 == "後"){
                endMoment.add(2, 'day');
            } else if (day1 == "大後"){
                endMoment.add(3, 'day');
            }
            result.end.assign('day', endMoment.date());
            result.end.assign('month', endMoment.month() + 1);
            result.end.assign('year', endMoment.year());
        } else if (match[DAY_GROUP_3]) {
            var day3 = match[DAY_GROUP_3];
            if (day3 == '明' || day3 == '聽') {
                endMoment.add(1, 'day');
            } else if (day3 == '昨' || day3 == '尋' || day3 == '琴') {
                endMoment.add(-1, 'day');
            } else if (day3 == "前"){
                endMoment.add(-2, 'day');
            } else if (day3 == "大前"){
                endMoment.add(-3, 'day');
            } else if (day3 == "後"){
                endMoment.add(2, 'day');
            } else if (day3 == "大後"){
                endMoment.add(3, 'day');
            }
            result.end.assign('day', endMoment.date());
            result.end.assign('month', endMoment.month() + 1);
            result.end.assign('year', endMoment.year());
        } else {
            result.end.imply('day', endMoment.date());
            result.end.imply('month', endMoment.month() + 1);
            result.end.imply('year', endMoment.year());
        }

        hour = 0;
        minute = 0;
        meridiem = -1;

        // ----- Second
        if (match[SECOND_GROUP]) {
            var second = parseInt(match[SECOND_GROUP]);
            if (isNaN(second)) {
                second = util.zhStringToNumber(match[SECOND_GROUP]);
            }

            if (second >= 60) return null;
            result.end.assign('second', second);
        }

        hour = parseInt(match[HOUR_GROUP]);
        if (isNaN(hour)) {
            hour = util.zhStringToNumber(match[HOUR_GROUP]);
        }

        // ----- Minutes
        if (match[MINUTE_GROUP]) {
            if (match[MINUTE_GROUP] == '半') {
                minute = 30;
            } else if (match[MINUTE_GROUP] == '正' || match[MINUTE_GROUP] == '整') {
                minute = 0;
            } else {
                minute = parseInt(match[MINUTE_GROUP]);
                if (isNaN(minute)) {
                    minute = util.zhStringToNumber(match[MINUTE_GROUP]);
                }
            }
        } else if (hour > 100) {
            minute = hour % 100;
            hour = parseInt(hour / 100);
        }

        if (minute >= 60) {
            return null;
        }

        if (hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }

        // ----- AM & PM
        if (match[AM_PM_HOUR_GROUP]) {
            if (hour > 12) return null;
            var ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
            if (ampm == "a") {
                meridiem = 0;
                if (hour == 12) hour = 0;
            }

            if (ampm == "p") {
                meridiem = 1;
                if (hour != 12) hour += 12;
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

        } else if (match[ZH_AM_PM_HOUR_GROUP_1]) {
            var zhAMPMString1 = match[ZH_AM_PM_HOUR_GROUP_1];
            var zhAMPM1 = zhAMPMString1[0];
            if (zhAMPM1 == '朝' || zhAMPM1 == '早') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM1 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        } else if (match[ZH_AM_PM_HOUR_GROUP_2]) {
            var zhAMPMString2 = match[ZH_AM_PM_HOUR_GROUP_2];
            var zhAMPM2 = zhAMPMString2[0];
            if (zhAMPM2 == '上' || zhAMPM2 == '朝' || zhAMPM2 == '早' || zhAMPM2 == '凌') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM2 == '下' || zhAMPM2 == '晏' || zhAMPM2 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        } else if (match[ZH_AM_PM_HOUR_GROUP_3]) {
            var zhAMPMString3 = match[ZH_AM_PM_HOUR_GROUP_3];
            var zhAMPM3 = zhAMPMString3[0];
            if (zhAMPM3 == '上' || zhAMPM3 == '朝' || zhAMPM3 == '早' || zhAMPM3 == '凌') {
                meridiem = 0;
                if (hour == 12) hour = 0;
            } else if (zhAMPM3 == '下' || zhAMPM3 == '晏' || zhAMPM3 == '晚') {
                meridiem = 1;
                if (hour != 12) hour += 12;
            }
        }

        result.text = result.text + match[0];
        result.end.assign('hour', hour);
        result.end.assign('minute', minute);
        if (meridiem >= 0) {
            result.end.assign('meridiem', meridiem);
        } else {
            var startAtPM = result.start.isCertain('meridiem') && result.start.get('meridiem') == 1;
            if (startAtPM && result.start.get('hour') > hour) {
                // 10pm - 1 (am)
                result.end.imply('meridiem', 0);

            } else if (hour > 12) {
                result.end.imply('meridiem', 1);
            }
        }

        if (result.end.date().getTime() < result.start.date().getTime()) {
            result.end.imply('day', result.end.get('day') + 1)
        }

        return result;
    };
};
