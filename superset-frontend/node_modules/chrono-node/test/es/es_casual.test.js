var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "La fecha límite es ahora";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 8, 9, 10, 11));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(19)
        expect(result.text).toBe('ahora')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(8)
        expect(result.start.get('minute')).toBe(9)
        expect(result.start.get('second')).toBe(10)
        expect(result.start.get('millisecond')).toBe(11)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 9, 10, 11);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fecha límite es hoy";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(19)
        expect(result.text).toBe('hoy')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fecha límite es Mañana";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(19)
        expect(result.text).toBe('Mañana')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(11)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    // Say.."Tomorrow" in the late night (1 AM)
    var text = "La fecha límite es Tomorrow";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 1));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fecha límite fue ayer";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(20)
        expect(result.text).toBe('ayer')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(9)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fehca límite fue anoche ";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(20)
        expect(result.text).toBe('anoche')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(9)
        expect(result.start.get('hour')).toBe(0)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fecha límite fue esta mañana ";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(20)
        expect(result.text).toBe('esta mañana')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(6)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La fecha límite fue esta tarde ";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(20)
        expect(result.text).toBe('esta tarde')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(18)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 18);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Combined Expression", function() {


    var text = "La fecha límite es hoy 5PM";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(19)
        expect(result.text).toBe('hoy 5PM')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        expect(result.start.get('hour')).toBe(17)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test('Test - Random text', function() {

    var text = "esta noche";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text)
    expect(result.start.get('year')).toBe(2012)
    expect(result.start.get('month')).toBe(1)
    expect(result.start.get('day')).toBe(1)
    expect(result.start.get('hour')).toBe(22)
    expect(result.start.get('meridiem') ).toBe(1)

    var text = "esta noche 8pm";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text)
    expect(result.start.get('hour') ).toBe(20)
    expect(result.start.get('year') ).toBe(2012)
    expect(result.start.get('month')).toBe(1)
    expect(result.start.get('day')  ).toBe(1)
    expect(result.start.get('meridiem') ).toBe(1)


    var text = "esta noche at 8"; // TODO
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text)
    expect(result.start.get('hour') ).toBe(20)
    expect(result.start.get('year') ).toBe(2012)
    expect(result.start.get('month')).toBe(1)
    expect(result.start.get('day')  ).toBe(1)
    expect(result.start.get('meridiem') ).toBe(1)


    var text = "jueves";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    expect(result.start.get('weekday')).toBe(4)


    var text = "viernes";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
    expect(result.start.get('weekday')).toBe(5)
})


test('Test - Random negative text', function() {

    var text = "nohoy";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)


    var text = "hymañana";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "xayer";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "porahora";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "ahoraxsd";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

})
