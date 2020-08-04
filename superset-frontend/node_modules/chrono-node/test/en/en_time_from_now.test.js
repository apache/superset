var chrono = require('../../src/chrono');

test("Test - Single Expression", function () {
    var text = "5 days from now, we did something";
    var results = chrono.parse(text, new Date(2012, 7, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 days from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 15, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "10 days from now, we did something";
    var results = chrono.parse(text, new Date(2012, 7, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(20);

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 days from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 20, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "15 minute from now";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('15 minute from now');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(29);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 29);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "15 minutes earlier";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('15 minutes earlier');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(59);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 11, 59);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "15 minute out";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('15 minute out');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(29);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 29);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "   12 hours from now";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(3);
        expect(result.text).toBe('12 hours from now');
        expect(result.start.get('day')).toBe(11);
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 0, 14);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "   half an hour from now";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(3);
        expect(result.text).toBe('half an hour from now');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(44);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 44);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "12 hours from now I did something";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('12 hours from now');
        expect(result.start.get('day')).toBe(11);
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 0, 14);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "12 seconds from now I did something";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('12 seconds from now');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(14);
        expect(result.start.get('second')).toBe(12);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "three seconds from now I did something";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('three seconds from now');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(14);
        expect(result.start.get('second')).toBe(3);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 3);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "5 Days from now, we did something";
    var results = chrono.parse(text, new Date(2012, 7, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 Days from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 15, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }


    var text = "   half An hour from now";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(3);
        expect(result.text).toBe('half An hour from now');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(44);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 44);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "A days from now, we did something";
    var results = chrono.parse(text, new Date(2012, 7, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);

        expect(result.index).toBe(0);
        expect(result.text).toBe('A days from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 11, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "a min out";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('a min out');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 15);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "in 1 hour";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('in 1 hour');
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 14);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "in 1.5 hours";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 40));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('in 1.5 hours');
        expect(result.start.get('hour')).toBe(14);
        expect(result.start.get('minute')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 14, 10);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }
});


test("Test - Single Expression (Casual)", function () {
    var text = "5 months from now, we did something";
    var results = chrono.parse(text, new Date(2012, 8 - 1, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(2 - 1);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 months from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1 - 1, 10, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "5 years from now, we did something";
    var results = chrono.parse(text, new Date(2012, 8 - 1, 10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2017);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 years from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2017, 8 - 1, 10, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }


    var text = "a week from now, we did something";
    var results = chrono.parse(text, new Date(2012, 8 - 1, 3));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('a week from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 10, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }

    var text = "a few days from now, we did something";
    var results = chrono.parse(text, new Date(2012, 8 - 1, 3));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(6);

        expect(result.index).toBe(0);
        expect(result.text).toBe('a few days from now');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8 - 1, 6, 12);
        expect(expectDate.getTime()).toBe(resultDate.getTime())
    }
});

test("Test - Single Expression (Strict)", function () {

    var text = "15 min from now";
    var results = chrono.strict.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(0);

    var text = "15 minutes from now";
    var results = chrono.strict.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var text = "a week from now, we did something";
    var results = chrono.strict.parse(text, new Date(2012, 8 - 1, 3));
    expect(results.length).toBe(0)
});
