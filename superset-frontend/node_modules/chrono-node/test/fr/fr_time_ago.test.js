var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "il y a 5 jours, on a fait quelque chose";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(5);

        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 5 jours');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "il y a 10 jours, on a fait quelque chose";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(31);

        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 10 jours');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "il y a 15 minutes";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 15 minutes');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(59);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "   il y a    12 heures";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(3);
        expect(result.text).toBe('il y a    12 heures');
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,0,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "   half an hour ago";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(3);
        expect(result.text).toBe('half an hour ago');
        expect(result.start.get('hour')).toBe(11);
        expect(result.start.get('minute')).toBe(44);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,11,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "il y a 12 heures il s'est passé quelque chose";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 12 heures');
        expect(result.start.get('hour')).toBe(0);
        expect(result.start.get('minute')).toBe(14);

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,0,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }




    var text = "5 Days ago, we did something";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(5);

        expect(result.index).toBe(0);
        expect(result.text).toBe('5 Days ago');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 5, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Single Expression (Casual)", function() {

    var text = "il y a 5 mois, on a fait quelque chose";
    var results = chrono.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 5 mois');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 3-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "il y a 5 ans, on a fait quelque chose";
    var results = chrono.parse(text, new Date(2012, 8-1,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2007);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a 5 ans');

        var resultDate = result.start.date();
        var expectDate = new Date(2007, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "il y a une semaine, on a fait quelque chose";
    var results = chrono.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(27);

        expect(result.index).toBe(0);
        expect(result.text).toBe('il y a une semaine');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 27, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

