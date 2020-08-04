var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "we have to make something in 5 days.";
    var results = chrono.parse(text, new Date(2012,7,10));

    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(26);
        expect(result.text).toBe('in 5 days');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "we have to make something in five days.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(26);
        expect(result.text).toBe('in five days');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "we have to make something within 10 day";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(26);
        expect(result.text).toBe('within 10 day');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(20);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 20, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in 5 minutes";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in 5 minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "within 1 hour";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within 1 hour');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,13,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "In 5 minutes I will go home";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 minutes A car need to move";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 seconds A car need to move";
    var results = chrono.parse(text, new Date(2012,7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 seconds');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 5);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within half an hour";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within half an hour');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within two weeks";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within two weeks');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within a month";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within a month');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within a few months";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within a few months');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within one year";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within one year');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within one Year";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within one Year');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "within One year";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('within One year');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 Minutes A car need to move";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 Minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 mins a car need to move";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 mins');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "in a week";
    var result = chrono.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(8);
    expect(result.start.get('hour')).toBe(12);

});


test("Test - Single Expression (Strict)", function() {

    var text = "within one year";
    var results = chrono.strict.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(0);


    var text = "within a few months";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)


    var text = "within a few days";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)
});


test("Test - Single Expression (Implied)", function() {

    var text = "within 30 days";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

    var text = "within 30 months";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

    var text = "within 30 years";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

    var text = "within 5 hours";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

    var text = "within 5 minutes";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

    var text = "within 5 seconds";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);
    expect(!results[0].start.isCertain('year')).not.toBeNull();
    expect(!results[0].start.isCertain('month')).not.toBeNull();
    expect(!results[0].start.isCertain('day')).not.toBeNull();
    expect(!results[0].start.isCertain('hour')).not.toBeNull();
    expect(!results[0].start.isCertain('minute')).not.toBeNull();
    expect(!results[0].start.isCertain('second')).not.toBeNull();

});

