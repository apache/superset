var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "La deadline est maintenant";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 8, 9, 10, 11));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('maintenant');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(8);
        expect(result.start.get('minute')).toBe(9);
        expect(result.start.get('second')).toBe(10);
        expect(result.start.get('millisecond')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 9, 10, 11);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline est aujourd'hui";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('aujourd\'hui');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline est demain";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('demain');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    // Say.."Demain" in the late night (1 AM)
    var text = "La deadline est demain";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 1));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline était hier";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(18);
        expect(result.text).toBe('hier');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline était la veille";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(18);
        expect(result.text).toBe('la veille');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);
        expect(result.start.get('hour')).toBe(0);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline est ce matin";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('ce matin');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(8);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline est cet après-midi";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('cet après-midi');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "La deadline est cet aprem";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('cet aprem');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "La deadline est ce soir";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('ce soir');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(18);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 18);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Combined Expression", function() {


    var text = "La deadline est aujourd'hui 17:00";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('aujourd\'hui 17:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(17);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "La deadline est demain 17:00";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('demain 17:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);
        expect(result.start.get('hour')).toBe(17);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "La deadline est demain matin 11h";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(16);
        expect(result.text).toBe('demain matin 11h');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);
        expect(result.start.get('hour')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 11);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Casual date range", function() {

    var text = "L'évenènement est d'aujourd'hui à vendredi prochain";
    var results = chrono.casual.parse(text, new Date(2012, 7, 4, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe("aujourd'hui à vendredi prochain");

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(4);
        expect(result.start.get('hour')).toBe(12);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 4, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(10);
        expect(result.end.get('hour')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "L'évenènement est d'aujourd'hui à vendredi prochain";
    var results = chrono.casual.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe('aujourd\'hui à vendredi prochain');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(12);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())


        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(17);
        expect(result.end.get('hour')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 17, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});





test('Test - Random text', function() {

    var text = "cette nuit";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(22);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 8pm";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 20h";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 20:00";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 20h00";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 20h00m00";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "ce soir 20h00m00s";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "Ce soir à 20h";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "Ce soir a 20h";
    var result = chrono.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);


    var text = "jeu";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('weekday')).toBe(4);


    var text = "sam";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('weekday')).toBe(6)
});


test('Test - Random negative text', function() {

    var text = "pasaujourd'hui";
    var results = chrono.parse(text);
    expect(results.length).toBe(0);

    var text = "pashier";
    var results = chrono.parse(text);
    expect(results.length).toBe(0);

    var text = "maintenanter";
    var results = chrono.parse(text);
    expect(results.length).toBe(0);

});
