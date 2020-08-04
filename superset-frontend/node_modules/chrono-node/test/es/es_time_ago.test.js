var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "hace 5 días, hicimos algo";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(5)

        expect(result.index).toBe(0)
        expect(result.text).toBe('hace 5 días')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "hace 10 dias, hicimos algo";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(7)
        expect(result.start.get('day')).toBe(31)

        expect(result.index).toBe(0)
        expect(result.text).toBe('hace 10 dias')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "hace 15 minutos";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('hace 15 minutos')
        expect(result.start.get('hour')).toBe(11)
        expect(result.start.get('minute')).toBe(59)

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "   hace 12 horas";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(3)
        expect(result.text).toBe('hace 12 horas')
        expect(result.start.get('hour')).toBe(0)
        expect(result.start.get('minute')).toBe(14)

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,0,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Single Expression (Casual)", function() {

    var text = "hace 5 meses, hicimos algo";
    var results = chrono.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(3)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('hace 5 meses')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 3-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "hace 5 años, hicimos algo";
    var results = chrono.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2007)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)

        expect(result.index).toBe(0)
        expect(result.text).toBe('hace 5 años')

        var resultDate = result.start.date();
        var expectDate = new Date(2007, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "hace una semana, hicimos algo";
    var results = chrono.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(7)
        expect(result.start.get('day')).toBe(27)

        expect(result.index).toBe(0)
        expect(result.text).toBe('hace una semana')

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 27, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});
