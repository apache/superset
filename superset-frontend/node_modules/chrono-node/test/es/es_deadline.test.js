var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "tenemos que hacer algo en 5 días.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(23)
        expect(result.text).toBe('en 5 días')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(15)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "tenemos que hacer algo dentro de 10 dias";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(23)
        expect(result.text).toBe('dentro de 10 dias')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(20)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 20, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "en 5 minutos";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('en 5 minutos')

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "en una hora";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('en una hora')

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,13,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "en media hora";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('en media hora')

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});
