var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "On doit faire quelque chose dans 5 jours.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(28);
        expect(result.text).toBe('dans 5 jours');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "On doit faire quelque chose dans cinq jours.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(28);
        expect(result.text).toBe('dans cinq jours');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "we have to make something within 10 day";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(26);
        expect(result.text).toBe('within 10 day');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(20);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 20, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "dans 5 minutes";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('dans 5 minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "en 1 heure";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('en 1 heure');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,13,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Dans 5 minutes je vais rentrer chez moi";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Dans 5 minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Dans 5 secondes une voiture va bouger";
    var results = chrono.parse(text, new Date(2012,7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Dans 5 secondes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 5);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "dans deux semaines";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('dans deux semaines');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "dans un mois";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('dans un mois');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "dans quelques mois";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('dans quelques mois');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "en une année";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('en une année');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "dans une Année";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('dans une Année');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Dans 5 Minutes une voiture doit être bougée";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Dans 5 Minutes');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Dans 5 mins une voiture doit être bougée";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('Dans 5 mins');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


});


test("Test - Single Expression (Strict)", function() {

    var text = "en une année";
    var results = chrono.strict.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(0);


    var text = "en quelques mois";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)


    var text = "en quelques jours";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)
});
