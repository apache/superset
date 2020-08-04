var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "Quedemos a las 6.13 AM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(9)
        expect(result.text).toBe('a las 6.13 AM')

        expect(result.start).not.toBeNull()
        expect(result.start.get('hour')).toBe(6)
        expect(result.start.get('minute')).toBe(13)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6, 13);
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

    var text = " de 6:30pm a 11:00pm ";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(1)
        expect(result.text).toBe('de 6:30pm a 11:00pm')

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

test("Test - Date + Time Expression", function() {

    var text = "Algo pasó el 10 de Agosto de 2012 10:12:59 pm";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(13)
        expect(result.text).toBe('10 de Agosto de 2012 10:12:59 pm')

        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(22)
        expect(result.start.get('minute')).toBe(12)
        expect(result.start.get('second')).toBe(59)
        expect(result.start.get('millisecond')).toBe(0)
        expect(result.start.isCertain('millisecond')).toBe(false)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 22, 12, 59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

})


test("Test - Time Expression's Meridiem imply", function() {

    var text = "hoy de 1pm a 3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('hoy de 1pm a 3')

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
})


test("Test - Random date + time expression", function() {

    var text = "lunes 4/29/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "miércoles 5/1/2013 1115am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "viernes 5/3/2013 1230pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)


    var text = "domingo 5/6/2013  750am-910am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "lunes 5/13/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "miércoles 5/15/2013 1030am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "viernes 6/21/2013 2:30";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "martes 7/2/2013 1-230 pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Lunes, 6/24/2013, 7:00pm - 8:30pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Jueves6/20/2013 from 7:00 PM to 10:00 PM";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "Miércoles, 3 Julio de 2013 a las 2pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)


    var text = "6pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "6 pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "7-10pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "11.1pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "a las 12";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)

    var text = "a mediodia";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    expect(result.start.get('hour')).toBe(12)
    expect(result.start.get('hour')).toBe(12)

    var text = "a medianoche";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
})
