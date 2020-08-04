/*

*/
var ParsedComponents = require('../../result').ParsedComponents;
var Refiner = require('../refiner').Refiner;


var PATTERN = new RegExp("^\\s*(at|after|before|on|,|-|\\(|\\))?\\s*$");

function isMoreSpecific(prevResult, currResult) {
    var moreSpecific = false;

    if (prevResult.start.isCertain('year')) {
        if (!currResult.start.isCertain('year')) {
            moreSpecific = true;
        } else {
            if (prevResult.start.isCertain('month')) {
                if (!currResult.start.isCertain('month')) {
                    moreSpecific = true;
                } else {
                    if (prevResult.start.isCertain('day') && !currResult.start.isCertain('day')) {
                        moreSpecific = true;
                    }
                }
            }
        }
    }

    return moreSpecific;
}


function isAbleToMerge(text, prevResult, currResult) {
    var textBetween = text.substring(prevResult.index + prevResult.text.length, currResult.index);

    // Only accepts merge if one of them comes from casual relative date
    var includesRelativeResult = (prevResult.tags['ENRelativeDateFormatParser'] || currResult.tags['ENRelativeDateFormatParser']);

    // We assume they refer to the same date if all date fields are implied
    var referToSameDate = !prevResult.start.isCertain('day') && !prevResult.start.isCertain('month') && !prevResult.start.isCertain('year');

    // If both years are certain, that determines if they refer to the same date
    // but with one more specific than the other
    if (prevResult.start.isCertain('year') && currResult.start.isCertain('year'))
        referToSameDate = (prevResult.start.get('year') === currResult.start.get('year'));

    // We now test with the next level (month) if they refer to the same date
    if (prevResult.start.isCertain('month') && currResult.start.isCertain('month'))
        referToSameDate = (prevResult.start.get('month') === currResult.start.get('month')) && referToSameDate;

    return includesRelativeResult && textBetween.match(PATTERN) && referToSameDate;
}

function mergeResult(text, specificResult, nonSpecificResult){

    var specificDate = specificResult.start;
    var nonSpecificDate = nonSpecificResult.start;

    var startIndex = Math.min(specificResult.index, nonSpecificResult.index);
    var endIndex = Math.max(
            specificResult.index + specificResult.text.length,
            nonSpecificResult.index + nonSpecificResult.text.length);

    specificResult.index = startIndex;
    specificResult.text  = text.substring(startIndex, endIndex);

    for (var tag in nonSpecificResult.tags) {
        specificResult.tags[tag] = true;
    }
    specificResult.tags['ENPrioritizeSpecificDateRefiner'] = true;
    return specificResult;
}

exports.Refiner = function ENPrioritizeSpecificDateRefiner() {
    Refiner.call(this);

    this.refine = function(text, results, opt) {

        if (results.length < 2) return results;

        var mergedResult = [];
        var currResult = null;
        var prevResult = null;

        for (var i = 1; i < results.length; i++) {

            currResult = results[i];
            prevResult = results[i-1];

            if (isMoreSpecific(prevResult, currResult)
                    && isAbleToMerge(text, prevResult, currResult)) {

                prevResult = mergeResult(text, prevResult, currResult);
                currResult = null;
                i += 1;

            } else if (isMoreSpecific(currResult, prevResult)
                    && isAbleToMerge(text, prevResult, currResult)) {

                prevResult = mergeResult(text, currResult, prevResult);
                currResult = null;
                i += 1;
            }

            mergedResult.push(prevResult);
        }

        if (currResult != null) {
            mergedResult.push(currResult);
        }

        return mergedResult;
    }
}
