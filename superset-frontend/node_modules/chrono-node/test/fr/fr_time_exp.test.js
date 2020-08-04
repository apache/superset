var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "8h10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8h10')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8h10m";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8h10m')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8h10m00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8h10m00')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(true)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8h10m00s";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8h10m00s')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(true)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8:10 PM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8:10 PM')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(20)
        expect(result.start.get('minute')).toBe(10)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 20, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8h10 PM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8h10 PM')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(20)
        expect(result.start.get('minute')).toBe(10)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 20, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "1230pm";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('1230pm')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(12)
        expect(result.start.get('minute')).toBe(30)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 30);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
	
    var text = "5:16p";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('5:16p')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(17)
        expect(result.start.get('minute')).toBe(16)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5h16p";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('5h16p')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(17)
        expect(result.start.get('minute')).toBe(16)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5h16mp";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('5h16mp')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(17)
        expect(result.start.get('minute')).toBe(16)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5:16 p.m.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('5:16 p.m.')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(17)
        expect(result.start.get('minute')).toBe(16)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5h16 p.m.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('5h16 p.m.')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(17)
        expect(result.start.get('minute')).toBe(16)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "RDV à 6.13 AM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(4)
        expect(result.text).toBe('à 6.13 AM')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(6)
        expect(result.start.get('minute')).toBe(13)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6, 13);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = '13h-15h';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('13h-15h')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(15)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('meridiem')).toBe(1)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 15, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = '13-15h';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('13-15h')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(15)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('meridiem')).toBe(1)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 15, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = '1-3pm';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('1-3pm')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(15)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('meridiem')).toBe(1)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 15, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = '11pm-2';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('11pm-2')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(23)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 23, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(2)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('meridiem')).toBe(0)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 11, 2, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Range Expression", function() {

    var text = "8:10 - 12.32";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8:10 - 12.32')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)

        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(12)
        expect(result.end.get('minute')).toBe(32)

        expect(result.end.isCertain('day')).toBe(false)
        expect(result.end.isCertain('month')).toBe(false)
        expect(result.end.isCertain('year')).toBe(false)
        expect(result.end.isCertain('hour')).toBe(true)
        expect(result.end.isCertain('minute')).toBe(true)
        expect(result.end.isCertain('second')).toBe(false)
        expect(result.end.isCertain('millisecond')).toBe(false)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 12, 32);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8:10 - 12h32";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('8:10 - 12h32')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(10)

        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('hour')).toBe(true)
        expect(result.start.isCertain('minute')).toBe(true)
        expect(result.start.isCertain('second')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(12)
        expect(result.end.get('minute')).toBe(32)

        expect(result.end.isCertain('day')).toBe(false)
        expect(result.end.isCertain('month')).toBe(false)
        expect(result.end.isCertain('year')).toBe(false)
        expect(result.end.isCertain('hour')).toBe(true)
        expect(result.end.isCertain('minute')).toBe(true)
        expect(result.end.isCertain('second')).toBe(false)
        expect(result.end.isCertain('millisecond')).toBe(false)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 12, 32);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = " from 6:30pm to 11:00pm ";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(1)
        expect(result.text).toBe('from 6:30pm to 11:00pm')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(18)
        expect(result.start.get('minute')).toBe(30)
        expect(result.start.get('meridiem')).toBe(1)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 18, 30);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
        
        expect(result.end).not.toBeNull()
        expect(result.end.get('hour')).toBe(23)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('meridiem')).toBe(1)

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 23, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

});

test("Test - Impossible", function() {

    var text = "8:62";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "25:12";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)

    var text = "12h12:99s";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)


    var text = "13.12 PM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)
});

test("Test - Date + Time Expression", function() {

    var text = "Quelque chose se passe le 2014-04-18 à 3h00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(26)
        expect(result.text).toBe('2014-04-18 à 3h00')

        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(18)
        expect(result.start.get('hour')).toBe(3)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 3, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Quelque chose se passe le 10 Août 2012 à 10:12:59";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(26)
        expect(result.text).toBe('10 Août 2012 à 10:12:59')

        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(10)
        expect(result.start.get('minute')).toBe(12)
        expect(result.start.get('second')).toBe(59)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 10, 12, 59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Quelque chose se passe le 15juin 2016 20h";
    var results = chrono.parse(text, new Date(2016,6,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(26)
        expect(result.text).toBe('15juin 2016 20h')

        expect(result.start.get('year')).toBe(2016)
        expect(result.start.get('month')).toBe(6)
        expect(result.start.get('day')).toBe(15)
        expect(result.start.get('hour')).toBe(20)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 6-1, 15, 20, 0, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Quelque chose se passe le 2014-04-18 7:00 - 8h00 ...";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(26)
        expect(result.text).toBe('2014-04-18 7:00 - 8h00')

        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(18)
        expect(result.start.get('hour')).toBe(7)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('meridiem')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 7, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end.get('year')).toBe(2014)
        expect(result.end.get('month')).toBe(4)
        expect(result.end.get('day')).toBe(18)
        expect(result.end.get('hour')).toBe(8)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.end.isCertain('meridiem')).toBe(false)
        expect(result.end.isCertain('millisecond')).toBe(false)

        var resultDate = result.end.date();
        var expectDate = new Date(2014, 4-1, 18, 8, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "Quelque chose se passe le 2014-04-18 de 7:00 à 20:00 ...";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(26)
        expect(result.text).toBe('2014-04-18 de 7:00 à 20:00')

        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(18)
        expect(result.start.get('hour')).toBe(7)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('meridiem')).toBe(false)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 7, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end.get('year')).toBe(2014)
        expect(result.end.get('month')).toBe(4)
        expect(result.end.get('day')).toBe(18)
        expect(result.end.get('hour')).toBe(20)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.start.isCertain('meridiem')).toBe(false)
        expect(result.end.isCertain('millisecond')).toBe(false)

        var resultDate = result.end.date();
        var expectDate = new Date(2014, 4-1, 18, 20, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
})


test("Test - Time Expression's Meridiem imply", function() {

    var text = "1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('1pm-3')

        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)
        expect(result.start.isCertain('meridiem')).toBe(true)

        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(8)
        expect(result.end.get('day')).toBe(11)
        expect(result.end.get('hour')).toBe(3)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "18-04-2014 1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('18-04-2014 1pm-3')

        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(18)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)
        expect(result.start.isCertain('meridiem')).toBe(true)

        expect(result.end.get('year')).toBe(2014)
        expect(result.end.get('month')).toBe(4)
        expect(result.end.get('day')).toBe(19)
        expect(result.end.get('hour')).toBe(3)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "aujourd'hui de 1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe("aujourd'hui de 1pm-3")

        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(13)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.get('meridiem')).toBe(1)
        expect(result.start.isCertain('meridiem')).toBe(true)

        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(8)
        expect(result.end.get('day')).toBe(11)
        expect(result.end.get('hour')).toBe(3)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "ajd de 1am-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('ajd de 1am-3')

        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(1)
        expect(result.start.get('minute')).toBe(0)
        expect(result.start.get('second')).toBe(0)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.get('meridiem')).toBe(0)
        expect(result.start.isCertain('meridiem')).toBe(true)

        expect(result.end.get('year')).toBe(2012)
        expect(result.end.get('month')).toBe(8)
        expect(result.end.get('day')).toBe(10)
        expect(result.end.get('hour')).toBe(3)
        expect(result.end.get('minute')).toBe(0)
        expect(result.end.get('second')).toBe(0)
        expect(result.end.get('millisecond')).toBe(0)
        expect(result.end.isCertain('meridiem')).toBe(false)
    }
})


test("Test - Timezone extraction", function() {

    var text = "Vendredi à 2 pm";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text)
    expect(result.start.isCertain('timezoneOffset')).toBe(false)
    expect(!result.start.get('timezoneOffset')).not.toBeNull()


    var text = "vendredi 2 pm EST";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text)
    expect(result.start.isCertain('timezoneOffset')).toBe(true)
    expect(result.start.get('timezoneOffset')).toBe(-300)

    var text = "vendredi 15h CET";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text)
    expect(result.start.isCertain('timezoneOffset')).toBe(true)
    expect(result.start.get('timezoneOffset')).toBe(60)

    var text = "vendredi 15h cest";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text)
    expect(result.start.isCertain('timezoneOffset')).toBe(true)
    expect(result.start.get('timezoneOffset')).toBe(120)

    var text = "Vendredi à 2 pm est";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text)
    expect(result.start.isCertain('timezoneOffset')).toBe(true)
    expect(result.start.get('timezoneOffset')).toBe(-300)


    var text = "Vendredi à 2 pm j'ai rdv...";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe('Vendredi à 2 pm')
    expect(result.start.isCertain('timezoneOffset')).toBe(false)
    expect(!result.start.get('timezoneOffset')).not.toBeNull()


    var text = "Vendredi à 2 pm je vais faire quelque chose";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe('Vendredi à 2 pm')
    expect(result.start.isCertain('timezoneOffset')).toBe(false)
    expect(!result.start.get('timezoneOffset')).not.toBeNull()
})


test("Test - Random date + time expression", function() {

    var text = "lundi 29/4/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    
    var text = "mercredi 1/5/2013 1115am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    
    var text = "vendredi 3/5/2013 1230pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    
    var text = "dimanche 6/5/2013  750am-910am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "lundi 13/5/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "wednesday 5/15/2013 1030am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Vendredi 21/6/2013 2:30";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "mardi 7/2/2013 1-230 pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "mardi 7/2/2013 1-23h0";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "mardi 7/2/2013 1h-23h0m";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Lundi, 24/6/2013, 7:00pm - 8:30pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Jeudi6/5/2013 de 7h à 10h";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Mercredi, 3 juil 2013 14h";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)


    var text = "18h";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)


    var text = "18-22h";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "11h-13";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "that I need to know or am I covered?";
    var result = chrono.parse(text);
    expect(result.length).toBe(0)

    var text = "à 12h";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "a midi";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    expect(result.start.get('hour')).toBe(12)

    var text = "à minuit";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
})