var chrono = require('../../src/chrono');

test("Test - Single expression", function() {

    var text = "10 August 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "10 August 2555 BE";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August 2555 BE');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10 August 234 BC";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August 234 BC');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(-234);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(-234, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10 August 88 AD";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August 88 AD');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(88);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(88, 8-1, 10, 12);
        expectDate.setFullYear(88);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'Sun 15Sep';
    var results = chrono.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Sun 15Sep');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 9-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'SUN 15SEP';
    var results = chrono.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('SUN 15SEP');
        
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 9-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The Deadline is 10 August";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(16);
        expect(result.text).toBe('10 August');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "The Deadline is Tuesday, 10 January";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(16);
        expect(result.text).toBe('Tuesday, 10 January');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('weekday')).toBe(2);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "The Deadline is Tue, 10 January";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(16);
        expect(result.text).toBe('Tue, 10 January');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('weekday')).toBe(2);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "31st March, 2016";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(0);
        expect(result.text).toBe('31st March, 2016');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(31);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 3-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "23rd february, 2016";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(0);
        expect(result.text).toBe('23rd february, 2016');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(2);
        expect(result.start.get('day')).toBe(23);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 2-1, 23, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Single expression with separators", function() {

    var text = "10-August 2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('10-August 2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());


    var text = "10-August-2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('10-August-2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());

    var text = "10/August 2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('10/August 2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());


    var text = "10/August/2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('10/August/2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());
});

test("Test - Range expression", function() {

    var text = "10 - 22 August 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 - 22 August 2012');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(22);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "10 to 22 August 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 to 22 August 2012');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(22);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10 August - 12 September";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August - 12 September');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(9);
        expect(result.end.get('day')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 9-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10 August - 12 September 2013";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10 August - 12 September 2013');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2013);
        expect(result.end.get('month')).toBe(9);
        expect(result.end.get('day')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2013, 9-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Combined expression", function() {

    var text = "12th of July at 19:00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('12th of July at 19:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(12);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 12, 19, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "5 May 12:00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5 May 12:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(5);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 5-1, 5, 12, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "7 May 11:00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    
    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('7 May 11:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(7);
        expect(result.start.get('hour')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 5-1, 7, 11, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Ordinal Words", function () {


    var text = 'Twenty-fourth of May';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.text).toBe('Twenty-fourth of May');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(24);
    }


    var text = 'Eighth to eleventh May 2010';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.text).toBe('Eighth to eleventh May 2010');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2010);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(8);

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2010);
        expect(result.end.get('month')).toBe(5);
        expect(result.end.get('day')).toBe(11);
    }

});

test("Test - little endian date followed by time", function() {

    var text = '24th October, 9 am';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('24th October, 9 am');
    expect(results[0].start.get('day')).toBe(24);
    expect(results[0].start.get('month')).toBe(10);
    expect(results[0].start.get('hour')).toBe(9);

    var text = '24th October, 9 pm';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('24th October, 9 pm');
    expect(results[0].start.get('day')).toBe(24);
    expect(results[0].start.get('month')).toBe(10);
    expect(results[0].start.get('hour')).toBe(21);

    var text = '24 October, 9 pm';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('24 October, 9 pm');
    expect(results[0].start.get('day')).toBe(24);
    expect(results[0].start.get('month')).toBe(10);
    expect(results[0].start.get('hour')).toBe(21);

    var text = '24 October, 9 p.m.';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('24 October, 9 p.m.');
    expect(results[0].start.get('day')).toBe(24);
    expect(results[0].start.get('month')).toBe(10);
    expect(results[0].start.get('hour')).toBe(21);

    var text = '24 October 10 o clock';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('24 October 10 o clock');
    expect(results[0].start.get('day')).toBe(24);
    expect(results[0].start.get('month')).toBe(10);
    expect(results[0].start.get('hour')).toBe(10);    
});

test("Test - Impossible Dates (Strict Mode)", function() {
 
    var text = "32 August 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "29 February 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "32 August";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "29 February";
    var results = chrono.strict.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(0)

});

test("Test - Impossible Dates (Casual Mode)", function() {
 
    var text = "32 August 2015";
    var expectDate = new Date(2015, 8, 1, 12, 0);
    var results = chrono.parse(text);
    var resultDate = results[0].start.date();
    expect(results.length).toBe(1);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
});

