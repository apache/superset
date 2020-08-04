var chrono = require('../../src/chrono');

test("Test - Year Guessing", function() {

    // Parsing "January" on February (2016-02-15)
    var text = "January 1st";

    var result = chrono.casual.parse(text, new Date(2016, 2-1, 15))[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(1);
    }

    var result = chrono.casual.parse(text, new Date(2016, 2-1, 15), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2017);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(1);
    }
});

test("Test - Year Guessing (Range)", function() {

    // Parsing "February" on March (2016-02-15)
    var text = "22-23 Feb at 7pm";

    var result = chrono.casual.parse(text, new Date(2016, 3-1, 15))[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(2);
        expect(result.start.get('day')).toBe(22);
        expect(result.start.get('hour')).toBe(19);

        expect(result.end.get('year')).toBe(2016);
        expect(result.end.get('month')).toBe(2);
        expect(result.end.get('day')).toBe(23);
        expect(result.end.get('hour')).toBe(19);
    }

    var result = chrono.casual.parse(text, new Date(2016, 3-1, 15), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2017);
        expect(result.start.get('month')).toBe(2);
        expect(result.start.get('day')).toBe(22);
        expect(result.start.get('hour')).toBe(19);

        expect(result.end.get('year')).toBe(2017);
        expect(result.end.get('month')).toBe(2);
        expect(result.end.get('day')).toBe(23);
        expect(result.end.get('hour')).toBe(19);
    }
});

test("Test - Year Guessing (Fixed)", function() {

    // Parsing "February" on March (2016-02-15)
    var text = "22-23 Feb 2016 at 7pm";
    var result = chrono.casual.parse(text, new Date(2016, 3-1, 15), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(2);
        expect(result.start.get('day')).toBe(22);
        expect(result.start.get('hour')).toBe(19);

        expect(result.end.get('year')).toBe(2016);
        expect(result.end.get('month')).toBe(2);
        expect(result.end.get('day')).toBe(23);
        expect(result.end.get('hour')).toBe(19);
    }
});

test("Test - Weekday Guessing", function() {

    // Parsing "Monday" on Thursday (2012-08-09)
    var text = "Monday";

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9))[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(6);
    }

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(13);
    }
});


test("Test - Weekday Guessing (Range)", function() {

    // Parsing "Monday to Wednesday" on Thursday (2012-08-09)
    var text = "Monday - Wednesday";

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9))[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(6);

        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(8);
    }

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(13);

        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(15);
    }
});


test("Test - Weekday Guessing (Fixed)", function() {

    // Parsing "Monday" on Thursday (2012-08-09)
    var text = "Monday last week";

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9))[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(30);
    }

    var result = chrono.casual.parse(text, new Date(2012, 8-1, 9), {forwardDate: true})[0];
    
    if (result) {
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(30);
    }
});




