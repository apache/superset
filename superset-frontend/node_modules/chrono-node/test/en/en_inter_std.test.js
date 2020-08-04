var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "Let's finish this before this 2013-2-7.";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(2)
        expect(result.start.get('day')).toBe(7)

        var resultDate = (result.start.date());
        var expectDate = (new Date(2013,1,7,12));
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "1994-11-05T08:15:30-05:30";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1994)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(5)
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(15)
        expect(result.start.get('second')).toBe(30)
        expect(result.start.get('timezoneOffset')).toBe(-330)
        expect(result.text).toBe(text)
        
        var resultDate = result.start.date();
        var expectDate = new Date(784043130000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }    

    var text = "1994-11-05T13:15:30";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1994)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(5)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(15)
        expect(result.start.get('second')).toBe(30)
        expect(result.start.get('timezoneOffset')).toBe(0)
        expect(result.text).toBe(text)
        
        var resultDate = result.start.date();
        var expectDate = new Date(784041330000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }       

    var text = "2015-07-31T12:00:00";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)
    
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2015)
        expect(result.start.get('month')).toBe(7)
        expect(result.start.get('day')).toBe(31)
        expect(result.start.get('hour')).toBe(12)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('timezoneOffset')).toBe(0)
        expect(result.text).toBe(text)
        
        var resultDate = result.start.date();
        var expectDate = new Date(1438344000000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }    


    var text = "1994-11-05T13:15:30Z";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1994)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(5)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(15)
        expect(result.start.get('second')).toBe(30)
        expect(result.start.get('timezoneOffset')).toBe(0)
        expect(result.text).toBe(text)
        
        var resultDate = result.start.date();
        var expectDate = new Date(784041330000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }    

    var text = "1994-11-05T13:15:30Z";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1994)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(5)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(15)
        expect(result.start.get('second')).toBe(30)
        expect(result.start.get('timezoneOffset')).toBe(0)
        expect(result.text).toBe(text)
        
        var resultDate = result.start.date();
        var expectDate = new Date(784041330000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "- 1994-11-05T13:15:30Z";
    var results = chrono.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1994)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(5)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(15)
        expect(result.start.get('second')).toBe(30)
        expect(result.start.get('timezoneOffset')).toBe(0)

        expect(result.index).toBe(2)
        expect(result.text).toBe('1994-11-05T13:15:30Z')
        
        var resultDate = result.start.date();
        var expectDate = new Date(784041330000);
        
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "2016-05-07T23:45:00.487+01:00";
    var results = chrono.strict.parse(text, new Date(2012,7,8));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2016)
        expect(result.start.get('month')).toBe(5)
        expect(result.start.get('day')).toBe(7)
        expect(result.start.get('hour')).toBe(23)
        expect(result.start.get('minute')).toBe(45)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('timezoneOffset')).toBe(60)

        expect(result.text).toBe('2016-05-07T23:45:00.487+01:00')

        var resultDate = result.start.date();
        var expectDate = new Date(1462661100487);

        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Compare with native js", function() {

    var text = '1994-11-05T13:15:30Z';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())

    var text = '1994-02-28T08:15:30-05:30';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())

    var text = '1994-11-05T08:15:30-05:30';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '1994-11-05T08:15:30+11:30';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '2014-11-30T08:15:30-05:30';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = 'Sat, 21 Feb 2015 11:50:48 -0500';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '22 Feb 2015 04:12:00 -0000';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '1900-01-01T00:00:00-01:00';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '1900-01-01T00:00:00-00:00';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);

    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '9999-12-31T23:59:00-00:00';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);
    
    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = '09/25/2017 10:31:50.522 PM';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);
    
    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())
});
