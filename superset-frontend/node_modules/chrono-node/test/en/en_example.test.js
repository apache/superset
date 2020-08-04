var chrono = require('../../src/chrono');



test("Test - Custom parser example", function() {


    var christmasParser = new chrono.Parser();

    // Provide search pattern
    christmasParser.pattern = function () { return /Christmas/i } 

    // This function will be called when matched pattern is found
    christmasParser.extract = function(text, ref, match, opt) { 
        
        // Return a parsed result, that is 25 December
        return new chrono.ParsedResult({
            ref: ref,
            text: match[0],
            index: match.index,
            start: {    
                day: 25, 
                month: 12, 
            }
        });
    }

    var custom = new chrono.Chrono();
    custom.parsers.push(christmasParser);

    var resultDate = custom.parseDate("I'll arrive at 2.30AM on Christmas night", new Date(2013, 11, 10))
    var expectDate = new Date(2013, 12-1, 25, 2, 30, 0);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
});


test("Test - Custom refiner example", function() {


    var guessPMRefiner = new chrono.Refiner();

    // If there is no AM/PM specified, all time between 1:00 - 4:00 will be guessed as PM (13.00 - 16.00)
    guessPMRefiner.refine = function(text, results, opt) {

        results.forEach(function (result) {

            if (!result.start.isCertain('meridiem') 
                &&  result.start.get('hour') >= 1 && result.start.get('hour') < 4) {

                result.start.assign('meridiem', 1);
                result.start.assign('hour', result.start.get('hour') + 12);
            }
        });

        return results;
    } 

    var custom = new chrono.Chrono();
    custom.refiners.push(guessPMRefiner);

    var resultDate = custom.parseDate("This is at 2.30", new Date(2013, 11, 10))
    var expectDate = new Date(2013, 12-1, 10, 14, 30, 0);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    

    var resultDate = custom.parseDate("This is at 2.30 AM", new Date(2013, 11, 10))
    var expectDate = new Date(2013, 12-1, 10, 2, 30, 0);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
});

