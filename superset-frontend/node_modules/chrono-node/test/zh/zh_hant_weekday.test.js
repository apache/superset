var chrono = require('../../src/chrono');
test("Test - Single Expression", function () {

    var text = "星期四";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('星期四');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(1);
        expect(result.start.get('weekday')).toBe(4);


        expect(result.start.isCertain('day')).toBe(false);
        expect(result.start.isCertain('month')).toBe(false);
        expect(result.start.isCertain('year')).toBe(false);
        expect(result.start.isCertain('weekday')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 9-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "禮拜四 (forward dates only)";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2), {forwardDate: true});
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('禮拜四');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(8);
        expect(result.start.get('weekday')).toBe(4);


        expect(result.start.isCertain('day')).toBe(false);
        expect(result.start.isCertain('month')).toBe(false);
        expect(result.start.isCertain('year')).toBe(false);
        expect(result.start.isCertain('weekday')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 9-1, 8, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "禮拜日";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('禮拜日');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(4);
        expect(result.start.get('weekday')).toBe(0);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 9-1, 4, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "雞上個禮拜三全部都係雞";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(1);
        expect(result.text).toBe('上個禮拜三');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(24);
        expect(result.start.get('weekday')).toBe(3);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 8-1, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞下星期天全部都係雞";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(1);
        expect(result.text).toBe('下星期天');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(4);
        expect(result.start.get('weekday')).toBe(0);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 9-1, 4, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test('Test - forward dates only option', function () {

    var text = "星期六-星期一";
    var results = chrono.casual.parse(text, new Date(2016, 9-1, 2), {forwardDate: true});
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('星期六-星期一');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(3);
        expect(result.start.get('weekday')).toBe(6);

        expect(result.start.isCertain('day')).toBe(false);
        expect(result.start.isCertain('month')).toBe(false);
        expect(result.start.isCertain('year')).toBe(false);
        expect(result.start.isCertain('weekday')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 9-1, 3, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2016);
        expect(result.end.get('month')).toBe(9);
        expect(result.end.get('day')).toBe(5);
        expect(result.end.get('weekday')).toBe(1);

        expect(result.end.isCertain('day')).toBe(false);
        expect(result.end.isCertain('month')).toBe(false);
        expect(result.end.isCertain('year')).toBe(false);
        expect(result.end.isCertain('weekday')).toBe(true);

        var resultDate = result.end.date();
        var expectDate = new Date(2016, 9-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});
