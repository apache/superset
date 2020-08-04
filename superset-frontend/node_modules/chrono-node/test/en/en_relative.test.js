var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "this week";
    var result = chrono.parse(text, new Date(2017, 11-1, 19))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(11);
    expect(result.start.get('day')).toBe(19);
    expect(result.start.get('hour')).toBe(12);

    var text = "this month";
    var result = chrono.parse(text, new Date(2017, 11-1, 19))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(11);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "this month";
    var result = chrono.parse(text, new Date(2017, 11-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(11);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "this year";
    var result = chrono.parse(text, new Date(2017, 11-1, 19))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);


    var text = "next week";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(8);
    expect(result.start.get('hour')).toBe(12);

    var text = "next 2 weeks";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(15);
    expect(result.start.get('hour')).toBe(12);

    var text = "last week";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(24);
    expect(result.start.get('hour')).toBe(12);

    var text = "last 2 weeks";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(17);
    expect(result.start.get('hour')).toBe(12);

    var text = "next day";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(2);
    expect(result.start.get('hour')).toBe(12);

    var text = "next 2 days";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(3);
    expect(result.start.get('hour')).toBe(12);

    var text = "last day";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(30);
    expect(result.start.get('hour')).toBe(12);

    var text = "last 2 days";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(29);
    expect(result.start.get('hour')).toBe(12);

    var text = "next month";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(11);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "next 2 months";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(12);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "last month";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "last 2 months";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(8);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(12);

    var text = "next few weeks";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(22);
    expect(result.start.get('hour')).toBe(12);

    var text = "next four weeks";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(29);
    expect(result.start.get('hour')).toBe(12);

    var text = "past week";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(24);
    expect(result.start.get('hour')).toBe(12);

    var text = "next week at 10-06-2016";
    var results = chrono.parse(text, new Date(2016, 10-1, 1));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.text).toBe(text);
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(10);
        expect(result.start.get('day')).toBe(6);
        expect(result.start.get('hour')).toBe(12);
    }

    var text = "next month at 11-06-2016";
    var results = chrono.parse(text, new Date(2016, 10-1, 1));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.text).toBe(text);
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(11);
        expect(result.start.get('day')).toBe(6);
        expect(result.start.get('hour')).toBe(12);
    }

    var text = "next year at Feb-2017";
    var results = chrono.parse(text, new Date(2016, 10, 10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.text).toBe(text);
        expect(result.start.get('year')).toBe(2017);
        expect(result.start.get('month')).toBe(2);
        expect(result.start.get('day')).toBe(1);
        expect(result.start.get('hour')).toBe(12);
    }

    var text = "next week (Dec 2016)";
    var results = chrono.parse(text, new Date(2016, 11, 27));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.text).toBe('next week (Dec 2016')
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(12);
        expect(result.start.get('day')).toBe(1);
        expect(result.start.get('hour')).toBe(12);
    }

    var text = 'She is getting married next year (July 2013).';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(7)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(23)
        expect(result.text).toBe('next year (July 2013')

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});
