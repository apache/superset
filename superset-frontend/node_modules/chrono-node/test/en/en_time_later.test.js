var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "2 days later";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(12);

        expect(result.index).toBe(0);
        expect(result.text).toBe('2 days later');

        expect(result.start.isCertain('day')).toBe(true);
        expect(result.start.isCertain('month')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5 minutes later";
    var results = chrono.parse(text, new Date(2012, 7, 10, 10, 0));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(10);
        expect(result.start.get('minute')).toBe(5);        

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 minutes later');

        expect(result.start.isCertain('hour')).toBe(true);
        expect(result.start.isCertain('minute')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 10, 5);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "3 week later";
    var results = chrono.parse(text, new Date(2012, 7-1, 10, 10, 0));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(31);

        expect(result.index).toBe(0);
        expect(result.text).toBe('3 week later');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Single Expression (Strict)", function() {
    var text = "15 minute after";
    var results = chrono.strict.parse(text, new Date(2012,7,10,12,14));
    expect(results[0]).toBe(undefined);

    var text = "a week ago, we did something";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)

    var text = "in 25 minutes";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 40));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('in 25 minutes');
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(5);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 5);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }
});
