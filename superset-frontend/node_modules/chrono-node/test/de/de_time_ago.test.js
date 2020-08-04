var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "Wir unternahmen etwas vor 5 Tagen";
    var results = chrono.de.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(5);

        expect(result.index).toBe(22);
        expect(result.text).toBe('vor 5 Tagen');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Vor 10 Tagen unternahmen wir etwas";
    var results = chrono.de.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(31);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 10 Tagen');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "vor 15 minuten";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('vor 15 minuten');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(59);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "   vor 12 Stunden";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(3);
        expect(result.text).toBe('vor 12 Stunden');
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,0,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "   vor einer halben Stunde";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(3);
        expect(result.text).toBe('vor einer halben Stunde');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(44);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Vor 12 Stunden tat ich etwas";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 12 Stunden');
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,0,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Vor 12 Sekunden tat ich etwas";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 12 Sekunden');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(13);
        expect(result.start.get('second')).toBe(48);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 13, 48);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Vor drei Sekunden trank ich Tee";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor drei Sekunden');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(13);
        expect(result.start.get('second')).toBe(57);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 13, 57);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "Vor 5 tagen taten wir etwas";
    var results = chrono.de.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(5);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 5 tagen');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "   vor Einer halben stunde";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(3);
        expect(result.text).toBe('vor Einer halben stunde');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(44);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Vor einer tag, wir taten";
    var results = chrono.de.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor einer tag');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "vor einer min";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('vor einer min');
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(13);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,13);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

});


test("Test - Single Expression (Casual)", function() {

    var text = "Vor 5 Monaten unternahmen wir etwas";
    var results = chrono.de.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 5 Monaten');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 3-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Vor 5 Jahren unternahmen wir etwas";
    var results = chrono.de.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2007);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('Vor 5 Jahren');

        var resultDate = result.start.date();
        var expectDate = new Date(2007, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "vor einer Woche aßen wir Pizza";
    var results = chrono.de.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(27);

        expect(result.index).toBe(0);
        expect(result.text).toBe('vor einer Woche');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 27, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "vor einigen Tagen aßen wir Pizza";
    var results = chrono.de.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(31);

        expect(result.index).toBe(0);
        expect(result.text).toBe('vor einigen Tagen');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Single Expression (Strict)", function() {

    var text = "vor einer woche taten wir etwas";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)

    var text = "vor einer woche taten wir etwas";
    var results = chrono.de.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(1)
});
