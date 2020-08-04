var chrono = require('../../src/chrono');

test("Test - Month expression", function() {


    var text = "September 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('September 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Sept 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Sept 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Sep 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Sep 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Sep. 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Sep. 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Sep-2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Sep-2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The date is Sep 2012 is the date";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(9);

        expect(result.index).toBe(12);
        expect(result.text).toBe('Sep 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});
