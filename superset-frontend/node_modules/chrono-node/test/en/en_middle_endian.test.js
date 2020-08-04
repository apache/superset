var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {
    var text = 'She is getting married soon (July 2017).';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2017)
        expect(result.start.get('month')).toBe(7)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(29)
        expect(result.text).toBe('July 2017')

        var resultDate = result.start.date();
        var expectDate = new Date(2017, 7-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'She is leaving in August.';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(18)
        expect(result.text).toBe('August')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'I am arriving sometime in August, 2012, probably.';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(1)

        expect(result.index).toBe(26)
        expect(result.text).toBe('August, 2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 1, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'August 10, 2012';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('August 10, 2012')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'Nov 12, 2011';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2011)
        expect(result.start.get('month')).toBe(11)
        expect(result.start.get('day')).toBe(12)

        expect(result.index).toBe(0)
        expect(result.text).toBe('Nov 12, 2011')

        var resultDate = result.start.date();
        var expectDate = new Date(2011, 11-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'The Deadline is August 10';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(16)
        expect(result.text).toBe('August 10')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "The Deadline is August 10 2555 BE";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('August 10 2555 BE')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The Deadline is August 10, 345 BC";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('August 10, 345 BC')

        var resultDate = result.start.date();
        var expectDate = new Date(-345, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "The Deadline is August 10, 8 AD";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(16)
        expect(result.text).toBe('August 10, 8 AD')

        var resultDate = result.start.date();
        var expectDate = new Date(8, 8-1, 10, 12);
        expectDate.setFullYear(8);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'The Deadline is Tuesday, January 10';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.text).toBe('Tuesday, January 10')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(1)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('weekday')).toBe(2)

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'Sun, Mar. 6, 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }

    var text = 'Sun, March 6, 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }

    var text = 'Sun., March 6, 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }

    var text = 'Sunday, March 6, 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }

    var text = 'Sunday, March 6, 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }

    var text = 'Sunday, March, 6th 2016';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);
    var result = results[0];
    if(result){
        expect(result.text).toBe(text);
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(6);
    }
});

test("Test - Single expression with separators", function() {

    var text = "August-10, 2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('August-10, 2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());

    var text = "August/10 2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('August/10 2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());
    
    var text = "August/10/2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('August/10/2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());

    var text = "August-10-2012";
    var expectDate = new Date(2012, 8-1, 10, 12, 0);
    var result = chrono.parse(text, new Date(2012,7, 8))[0];
    expect(result.text).toBe('August-10-2012');
    expect(expectDate.getTime()).toBeCloseTo(result.start.date().getTime());
});

test("Test - Range expression", function() {

    var text = 'August 10 - 22, 2012';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('August 10 - 22, 2012')

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
        expect(result.end.get('day')).toBe(22)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'August 10 to 22, 2012';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('August 10 to 22, 2012')

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
        expect(result.end.get('day')).toBe(22)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'August 10 - November 12';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('August 10 - November 12')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        

        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(11)
        expect(result.end.get('day')).toBe(12)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 11-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'Aug 10 to Nov 12';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('Aug 10 to Nov 12')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        

        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(11)
        expect(result.end.get('day')).toBe(12)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 11-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'Aug 10 - Nov 12, 2013';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){

        expect(result.index).toBe(0)
        expect(result.text).toBe('Aug 10 - Nov 12, 2013')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        

        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2013)
        expect(result.end.get('month')).toBe(11)
        expect(result.end.get('day')).toBe(12)

        var resultDate = result.end.date();
        var expectDate = new Date(2013, 11-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'Aug 10 - Nov 12, 2011';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        
        expect(result.index).toBe(0)
        expect(result.text).toBe('Aug 10 - Nov 12, 2011')
        
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2011)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2011, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        

        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2011)
        expect(result.end.get('month')).toBe(11)
        expect(result.end.get('day')).toBe(12)

        var resultDate = result.end.date();
        var expectDate = new Date(2011, 11-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Ordinal Words", function () {

    var text = 'May eighth, 2010';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('May eighth, 2010');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2010);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(8);
    }


    var text = 'May twenty-fourth';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('May twenty-fourth');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(24);
    }


    var text = 'May eighth - tenth, 2010';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('May eighth - tenth, 2010');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2010);
        expect(result.start.get('month')).toBe(5);
        expect(result.start.get('day')).toBe(8);

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2010);
        expect(result.end.get('month')).toBe(5);
        expect(result.end.get('day')).toBe(10);
    }

});

test("Test - Impossible Dates (Strict Mode)", function() {
 
    var text = "August 32, 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "Febuary 29, 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "August 32";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "Febuary 29";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

});

test("Test - Impossible Dates (Casual Mode)", function() {
 
    var text = "August 32, 2015";
    var expectDate = new Date(2015, 8, 1, 12, 0);
    var results = chrono.parse(text);
    var resultDate = results[0].start.date();
    expect(results.length).toBe(1)
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
});
