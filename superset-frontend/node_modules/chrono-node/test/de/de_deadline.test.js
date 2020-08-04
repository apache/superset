var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "Genau in 5 Tagen müssen wir etwas unternehmen.";
    var results = chrono.de.parse(text, new Date(2012,7,10));

    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(6);
        expect(result.text).toBe('in 5 Tagen');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "Wir müssen in fünf Tagen etwas unternehmen.";
    var results = chrono.de.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(11);
        expect(result.text).toBe('in fünf Tagen');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in 5 Minuten";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in 5 Minuten');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "In 1 Stunde";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 1 Stunde');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,13,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "In 5 Minuten gehe ich nach Hause";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 Minuten');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 Minuten muss ein Auto umgestellt werden";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 Minuten');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In 5 Sekunden wird es zu schneien beginnen";
    var results = chrono.de.parse(text, new Date(2012,7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 Sekunden');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 5);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in einer halben Stunde";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in einer halben Stunde');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in zwei Wochen";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in zwei Wochen');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in einem Monat";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in einem Monat');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in einigen Monaten";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in einigen Monaten');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "in einem Jahr";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('in einem Jahr');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "In Einem jahr";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In Einem jahr');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "In 5 min kommt der Weihnachstmann";
    var results = chrono.de.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('In 5 min');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


});


test("Test - Single Expression (Strict)", function() {

    var text = "in einem Jahr";
    var results = chrono.strict.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(0);


    var text = "in einigen Monaten";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)


    var text = "in einigen Tagen";
    var results = chrono.strict.parse(text, new Date(2012, 8-1, 3));
    expect(results.length).toBe(0)
});
