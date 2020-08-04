var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "Die Deadline ist jetzt";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 8, 9, 10, 11));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('jetzt');

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


    var text = "Die Deadline ist heute";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline ist morgen";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('morgen');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(11);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 11, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    // Say.."Tomorrow" in the late night (1 AM)
    var text = "Die Deadline ist morgen";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 1));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war gestern";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('gestern');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war letzte Nacht ";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('letzte Nacht');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);
        expect(result.start.get('hour')).toBe(0);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war gestern Nacht ";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('gestern Nacht');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(9);
        expect(result.start.get('hour')).toBe(0);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 9, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war heute Morgen ";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute Morgen');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(6);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war heute Nachmittag ";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute Nachmittag');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 15);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline war heute Abend ";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute Abend');

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


    var text = "Die Deadline ist heute 17 Uhr";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute 17 Uhr');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(17);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Die Deadline ist heute um 17 Uhr";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(17);
        expect(result.text).toBe('heute um 17 Uhr');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(17);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Casual date range", function() {

    var text = "Der Event ist heute - nächsten Freitag";
    var results = chrono.de.parse(text, new Date(2012, 7, 4, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(14);
        expect(result.text).toBe('heute - nächsten Freitag');

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



    var text = "Der Event ist heute - nächsten Freitag";
    var results = chrono.de.parse(text, new Date(2012, 7, 10, 12));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(14);
        expect(result.text).toBe('heute - nächsten Freitag');

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

    var text = "heute Nacht";
    var result = chrono.de.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(22);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "heute Nacht um 20 Uhr";
    var result = chrono.de.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);


    var text = "heute Abend um 8";
    var result = chrono.de.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);

    var text = "8 Uhr abends";
    var result = chrono.de.parse(text, new Date(2012, 1-1, 1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour') ).toBe(20);
    expect(result.start.get('year') ).toBe(2012);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')  ).toBe(1);
    expect(result.start.get('meridiem') ).toBe(1);


    var text = "Do";
    var result = chrono.de.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('weekday')).toBe(4);


    var text = "Donnerstag";
    var result = chrono.de.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('weekday')).toBe(4);

    var text = "gestern Nachmittag";
    var result = chrono.de.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(30);
    expect(result.start.get('hour')).toBe(15);

    var text = "morgen Morgen";
    var result = chrono.de.parse(text, new Date(2016, 10-1, 1, 8))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(2);
    expect(result.start.get('hour')).toBe(6);

    var text = "uebermorgen Abend";
    var result = chrono.de.parse(text, new Date(2016, 10-1, 1, 8))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(10);
    expect(result.start.get('day')).toBe(3);
    expect(result.start.get('hour')).toBe(18);

    var text = "vorgestern Vormittag";
    var result = chrono.de.parse(text, new Date(2016, 10-1, 1))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2016);
    expect(result.start.get('month')).toBe(9);
    expect(result.start.get('day')).toBe(29);
    expect(result.start.get('hour')).toBe(9);
});


test('Test - Random negative text', function() {

    var text = "nicheute";
    var results = chrono.de.parse(text);
    expect(results.length).toBe(0);


    var text = "heutenicht";
    var results = chrono.de.parse(text);
    expect(results.length).toBe(0);

    var text = "angestern";
    var results = chrono.de.parse(text);
    expect(results.length).toBe(0);

    var text = "jetztig";
    var results = chrono.de.parse(text);
    expect(results.length).toBe(0);

    var text = "ljetztlich";
    var results = chrono.de.parse(text);
    expect(results.length).toBe(0)

});
