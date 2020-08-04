var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "Lundi";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Lundi')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(6)
        expect(result.start.get('weekday')).toBe(1)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('weekday')).toBe(true)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 6, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Lundi (forward dates only)";
    var results = chrono.casual.parse(text, new Date(2012,7,9), {forwardDate: true});
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Lundi')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(13)
        expect(result.start.get('weekday')).toBe(1)


        expect(result.start.isCertain('day')).toBe(false)
        expect(result.start.isCertain('month')).toBe(false)
        expect(result.start.isCertain('year')).toBe(false)
        expect(result.start.isCertain('weekday')).toBe(true)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 13, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Jeudi";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Jeudi')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(9)
        expect(result.start.get('weekday')).toBe(4)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Dimanche";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Dimanche')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(12)
        expect(result.start.get('weekday')).toBe(0)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "la deadline était vendredi dernier...";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(18)
        expect(result.text).toBe('vendredi dernier')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(3)
        expect(result.start.get('weekday')).toBe(5)

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 3, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Planifions une réuinion vendredi prochain";
    var results = chrono.casual.parse(text, new Date(2015, 3, 18));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(24)
        expect(result.text).toBe('vendredi prochain')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2015)
        expect(result.start.get('month')).toBe(4)
        expect(result.start.get('day')).toBe(24)
        expect(result.start.get('weekday')).toBe(5)

        var resultDate = result.start.date();
        var expectDate = new Date(2015, 3, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Weekday Overlap", function() {

    var text = "Dimanche 7 décembre 2014";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Dimanche 7 décembre 2014')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(12)
        expect(result.start.get('day')).toBe(7)
        expect(result.start.get('weekday')).toBe(0)


        expect(result.start.isCertain('day')).toBe(true)
        expect(result.start.isCertain('month')).toBe(true)
        expect(result.start.isCertain('year')).toBe(true)
        expect(result.start.isCertain('weekday')).toBe(true)

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 12-1, 7, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Dimanche 7/12/2014";
    var results = chrono.casual.parse(text, new Date(2012,7,9));
    expect(results.length).toBe(1)

    var result = results[0];
    if(result){
        expect(result.index).toBe(0)
        expect(result.text).toBe('Dimanche 7/12/2014')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(12)
        expect(result.start.get('day')).toBe(7)
        expect(result.start.get('weekday')).toBe(0)


        expect(result.start.isCertain('day')).toBe(true)
        expect(result.start.isCertain('month')).toBe(true)
        expect(result.start.isCertain('year')).toBe(true)
        expect(result.start.isCertain('weekday')).toBe(true)

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 12-1, 7, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


})



