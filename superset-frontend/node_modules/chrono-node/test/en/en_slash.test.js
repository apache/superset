var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {
    var text = "The event is going ahead (04/2016)";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2016)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(26)
        expect(result.text).toBe('04/2016')

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 4-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Published: 06/2004";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2004)
        expect(result.start.get('month')).toBe(6)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(11)
        expect(result.text).toBe('06/2004')

        var resultDate = result.start.date();
        var expectDate = new Date(2004, 6-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8/10/2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('8/10/2012')

        expect(result.start.isCertain('day')).toBe(true);
        expect(result.start.isCertain('month')).toBe(true);
        expect(result.start.isCertain('year')).toBe(true);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = ": 8/1/2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(2)
        expect(result.text).toBe('8/1/2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8/10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('8/10')

        expect(result.start.isCertain('day')).toBe(true);
        expect(result.start.isCertain('month')).toBe(true);
        expect(result.start.isCertain('year')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "The Deadline is 8/10/2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('8/10/2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The Deadline is Tuesday 11/3/2015";
    var results = chrono.parse(text, new Date(2015,10,3));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('Tuesday 11/3/2015')

        var resultDate = result.start.date();
        var expectDate = new Date(2015, 10, 3, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

});

test("Test - Single Expression Little-Endian", function() {

    var text = "8/10/2012";
    var results = chrono.en_GB.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(10)
        expect(result.start.get('day')).toBe(8)

        expect(result.index).toBe(0)
        expect(result.text).toBe('8/10/2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10-1, 8, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Single Expression Little-Endian with Month name", function() {

    var text = "8/Oct/2012";
    var results = chrono.en_GB.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(10)
        expect(result.start.get('day')).toBe(8)

        expect(result.index).toBe(0)
        expect(result.text).toBe('8/Oct/2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10-1, 8, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Single Expression Start with Year", function() {

    var text = "2012/8/10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('2012/8/10')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "The Deadline is 2012/8/10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('2012/8/10')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Single Expression Start with Year and Month Name", function() {

    var text = "2012/Aug/10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('2012/Aug/10')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The Deadline is 2012/aug/10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('2012/aug/10')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Range Expression", function() {


    var text = "8/10/2012 - 8/15/2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('8/10/2012 - 8/15/2012')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(8)
        expect(result.end.get('day')).toBe(15)
        
        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
    }
});

test('Test - Random date patterns', function() {
    var expectDate = new Date(2015, 4, 25, 12, 0);

    text = "2015-05-25";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    text = "2015/05/25";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    var text = "05-25-2015";
    var results = chrono.parse(text);
    var resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    text = "05/25/2015";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    text = "05.25.2015";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    // unambiguous date pattern
    text = "25/05/2015";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    // ambiguous US date pattern, expected 5th of June
    expectDate = new Date(2015, 5, 5, 12, 0);
    text = "06/05/2015";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(2015, 7, 13, 12, 0);
    text = "2015.8.13";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(2015, 7, 13, 12, 0);
    text = "2015.08.13";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(2015, 7, 13, 12, 0);
    text = "2015.08.13";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(2007, 7, 13, 12, 0);
    text = "2007/8/13";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(2007, 7, 13, 12, 0);
    text = "2007/08/13";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());


    expectDate = new Date(1999, 7, 13, 12, 0);
    text = "8/13/99";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());

    expectDate = new Date(1989, 7, 13, 12, 0);
    text = "8/13/89";
    results = chrono.parse(text);
    resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
});


test("Test - Impossible Date (Strict Mode)", function() {

    var text = "8/32/2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "8/32";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "2/29/2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "2014/22/29";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "2014/13/22";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)
});


test("Test - Impossible Dates (Casual Mode)", function() {
 
    var text = "9/31/2015";
    var expectDate = new Date(2015, 9, 1, 12, 0);
    var results = chrono.parse(text);
    var resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
});

test('Test - forward dates only option', function () {

    var text = "5/31";
    var results = chrono.parse(text, new Date(1999, 6-1, 1), {forwardDate: true});
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2000)
        expect(result.start.get('month')).toBe(5)
        expect(result.start.get('day')).toBe(31)

        expect(result.index).toBe(0)
        expect(result.text).toBe('5/31')

        expect(result.start.isCertain('day')).toBe(true);
        expect(result.start.isCertain('month')).toBe(true);
        expect(result.start.isCertain('year')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2000, 5-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

});
