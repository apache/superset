/*
    Enforce 'forwardDate' option to on the results. When there are missing component,
    e.g. "March 12-13 (without year)" or "Thursday", the refiner will try to adjust the result
    into the future instead of the past.
*/
var moment = require('moment');
var Refiner = require('./refiner').Refiner;

exports.Refiner = function ForwardDateRefiner() {
    Refiner.call(this);

    this.refine = function(text, results, opt) {

        if (!opt['forwardDate']) {
            return results;
        }

        results.forEach(function(result) {

            var refMoment = moment(result.ref);

            if (result.start.isCertain('day') && result.start.isCertain('month') &&
                !result.start.isCertain('year') &&
                refMoment.isAfter(result.start.moment())
            ) {
                // Adjust year into the future
                for (var i=0; i < 3 && refMoment.isAfter(result.start.moment()); i++) {
                    result.start.imply('year', result.start.get('year') + 1);

                    if (result.end && !result.end.isCertain('year')) {
                        result.end.imply('year', result.end.get('year') + 1);
                    }
                }

                result.tags['ExtractTimezoneOffsetRefiner'] = true;
            }

            if (!result.start.isCertain('day') && !result.start.isCertain('month') && !result.start.isCertain('year') &&
                result.start.isCertain('weekday') &&
                refMoment.isAfter(result.start.moment())
            ) {
                // Adjust date to the coming week
                if (refMoment.day() > result.start.get('weekday')) {
                    refMoment.day(result.start.get('weekday') + 7);
                } else {
                    refMoment.day(result.start.get('weekday'));
                }

                result.start.imply('day', refMoment.date());
                result.start.imply('month', refMoment.month() + 1);
                result.start.imply('year', refMoment.year());
                result.tags['ExtractTimezoneOffsetRefiner'] = true;
            }
        });

        return results;
    }
};
