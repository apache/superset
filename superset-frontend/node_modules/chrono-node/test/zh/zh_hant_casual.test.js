var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "雞而家全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 8, 9, 10, 11));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('而家');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(8);
        expect(result.start.get('minute')).toBe(9);
        expect(result.start.get('second')).toBe(10);
        expect(result.start.get('millisecond')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 9, 10, 11);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞今日全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今日');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞聽日全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('聽日');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    // Say.."Tomorrow" in the late night (1 AM)
    var text = "雞明天全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 1));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "雞後天凌晨全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 0, 0));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 12, 0, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "雞大前天凌晨全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 0, 0));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 7, 0, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞琴日全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('琴日');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞昨天晚上全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('昨天晚上');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);
        expect(result.start.get('hour')).toBe(22);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 22);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞今日朝早全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今日朝早');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(6);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞晏晝全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('晏晝');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 15);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "雞今晚全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今晚');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(22);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 22);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Combined Expression", function() {


    var text = "雞今日晏晝5點全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今日晏晝5點');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(17);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Casual date range", function() {

    var text = "雞今日 - 下禮拜五全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 4, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今日 - 下禮拜五');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(4);
        expect(result.start.get('hour')).toBe(12);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 4, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(10);
        expect(result.end.get('hour')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "雞今日 - 下禮拜五全部都係雞";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('今日 - 下禮拜五');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(12);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(17);
        expect(result.end.get('hour')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 17, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});





test('Test - Random text', function() {

    var text = "今日夜晚";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(22);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "今晚8點正";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);


    var text = "晚上8點";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);


    var text = "星期四";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('weekday')).toBe(4);
});
