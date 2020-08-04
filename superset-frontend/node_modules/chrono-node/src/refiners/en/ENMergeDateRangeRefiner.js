/*
  
*/
var Refiner = require('../refiner').Refiner;

exports.Refiner = function ENMergeDateRangeRefiner() {
    Refiner.call(this);

    this.pattern = function () { return /^\s*(to|\-)\s*$/i };

    this.refine = function(text, results, opt) {

        if (results.length < 2) return results;
        
        var mergedResult = [];
        var currResult = null;
        var prevResult = null;
        
        for (var i=1; i<results.length; i++){
            
            currResult = results[i];
            prevResult = results[i-1];
            
            if (!prevResult.end && !currResult.end 
                && this.isAbleToMerge(text, prevResult, currResult)) {
              
                prevResult = this.mergeResult(text, prevResult, currResult);
                currResult = null;
                i += 1;
            }
            
            mergedResult.push(prevResult);
        }
        
        if (currResult != null) {
            mergedResult.push(currResult);
        }


        return mergedResult;
    };

    this.isAbleToMerge = function(text, result1, result2) {
        var begin = result1.index + result1.text.length;
        var end   = result2.index;
        var textBetween = text.substring(begin,end);

        return textBetween.match(this.pattern());
    };

    this.isWeekdayResult = function (result) {
        return result.start.isCertain('weekday') && !result.start.isCertain('day');
    };

    this.mergeResult = function(text, fromResult, toResult) {

        if (!this.isWeekdayResult(fromResult) && !this.isWeekdayResult(toResult)) {
            
            var timeKeys = {'hour': true, 'minute': true, 'second': true};

            for (var key in toResult.start.knownValues) {
                if (!fromResult.start.isCertain(key)) {
                    fromResult.start.assign(key, toResult.start.get(key));
                }
            }

            for (var key in fromResult.start.knownValues) {
                if (!toResult.start.isCertain(key)) {
                    toResult.start.assign(key, fromResult.start.get(key));
                }
            }
        }

        if (fromResult.start.date().getTime() > toResult.start.date().getTime()) {
            
            var fromMoment = fromResult.start.moment();
            var toMoment = toResult.start.moment();

            if (this.isWeekdayResult(fromResult) && fromMoment.clone().add(-7, 'days').isBefore(toMoment)) {
                fromMoment = fromMoment.add(-7, 'days');
                fromResult.start.imply('day', fromMoment.date());
                fromResult.start.imply('month', fromMoment.month() + 1);
                fromResult.start.imply('year', fromMoment.year());
            } else if (this.isWeekdayResult(toResult) && toMoment.clone().add(7, 'days').isAfter(fromMoment)) {
                toMoment = toMoment.add(7, 'days');
                toResult.start.imply('day', toMoment.date());
                toResult.start.imply('month', toMoment.month() + 1);
                toResult.start.imply('year', toMoment.year());
            } else {
                var tmp = toResult;
                toResult = fromResult;
                fromResult = tmp;
            }
        }
        
        fromResult.end = toResult.start;

        

        for (var tag in toResult.tags) {
            fromResult.tags[tag] = true;
        }

            
        var startIndex = Math.min(fromResult.index, toResult.index);
        var endIndex = Math.max(
            fromResult.index + fromResult.text.length, 
            toResult.index + toResult.text.length);
            
        fromResult.index = startIndex;
        fromResult.text  = text.substring(startIndex, endIndex);
        fromResult.tags[this.constructor.name] = true;
        return fromResult;
    }
};

