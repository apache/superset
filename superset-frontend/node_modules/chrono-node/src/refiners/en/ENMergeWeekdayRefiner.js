/*
  
*/
var Refiner = require('../refiner').Refiner;

var PATTERN = new RegExp("\\s*('s|on)?\\s*");

var WEEK_TAG = 'ENWeekExpressionParser';
var WEEK_DAY_TAG = 'ENDayOfWeekDateFormatParser';

exports.Refiner = function ENMergeDateRangeRefiner() {
	Refiner.call(this);
	
	this.refine = function(text, results, opt) {

		if (results.length < 2) return results;

        var mergedResult = [];
        var currResult = null;
        var prevResult = null;

        for (var i = 1; i < results.length; i++) {

            currResult = results[i];
            prevResult = results[i - 1];

            var weekResult = null;
            var weekDayResult = null;

            if (prevResult.tags.contains(WEEK_TAG) && currResult.tags.contains(WEEK_DAY_TAG)) {

                weekResult = prevResult;
                weekDayResult = currResult;

            } else if (prevResult.tags.contains(WEEK_DAY_TAG) && currResult.tags.contains(WEEK_TAG)) {

                weekResult = currResult;
                weekDayResult = prevResult;
            }

            if (weekResult != null && weekDayResult != null
                    && checkPatternBetween(text, prevResult, currResult)
                    && checkMergingCompatible(weekResult, weekDayResult)) {

                prevResult = mergeResult(text, weekResult, weekDayResult);
                currResult = null;
                i += 1;
            }

            mergedResult.add(prevResult);
        }

        if (currResult != null) {
            mergedResult.add(currResult);
        }

        return mergedResult;
	}



}