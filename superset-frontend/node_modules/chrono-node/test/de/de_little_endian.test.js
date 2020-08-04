var chrono = require('../../src/chrono');

test("Test - Single expression", function() {


    var text = "10. August 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        expect(result.index).toBe(0);
        expect(result.text).toBe('10. August 2012');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "10. August 113 v. Chr.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('10. August 113 v. Chr.');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(-113);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(-113, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10. August 85 n. Chr.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('10. August 85 n. Chr.');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(85);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(85, 8-1, 10, 12);
        expectDate.setFullYear(85);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = 'So 15.Sep';
    var results = chrono.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('So 15.Sep');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 9-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = 'SO 15.SEPT';
    var results = chrono.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('SO 15.SEPT');
        
        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(9);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 9-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Die Deadline ist am 10. August";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(17);
        expect(result.text).toBe('am 10. August');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline ist am Dienstag, den 10. Januar";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(17);
        expect(result.text).toBe('am Dienstag, den 10. Januar');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('weekday')).toBe(2);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "Die Deadline ist Di, 10. Januar";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(17);
        expect(result.text).toBe('Di, 10. Januar');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(1);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('weekday')).toBe(2);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 1-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "31. März 2016";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(0);
        expect(result.text).toBe('31. März 2016');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(31);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 3-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "31.Maerz 2016";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {

        expect(result.index).toBe(0);
        expect(result.text).toBe('31.Maerz 2016');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2016);
        expect(result.start.get('month')).toBe(3);
        expect(result.start.get('day')).toBe(31);

        var resultDate = result.start.date();
        var expectDate = new Date(2016, 3-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Range expression", function() {


    var text = "10. - 22. August 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10. - 22. August 2012');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(22);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 8-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "10. bis 22. Oktober 2012";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10. bis 22. Oktober 2012');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(10);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(10);
        expect(result.end.get('day')).toBe(22);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 10-1, 22, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10. Oktober - 12. Dezember";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10. Oktober - 12. Dezember');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(10);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(12);
        expect(result.end.get('day')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 12-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "10. August - 12. Oktober 2013";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){

        expect(result.index).toBe(0);
        expect(result.text).toBe('10. August - 12. Oktober 2013');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2013);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        

        expect(result.end).not.toBeNull();
        expect(result.end.get('year')).toBe(2013);
        expect(result.end.get('month')).toBe(10);
        expect(result.end.get('day')).toBe(12);

        var resultDate = result.end.date();
        var expectDate = new Date(2013, 10-1, 12, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Combined expression", function() {

    var text = "12. Juli um 19:00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('12. Juli um 19:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(12);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 12, 19, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "12. Juli um 19 Uhr";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('12. Juli um 19 Uhr');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(12);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 12, 19, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "12. Juli um 19:53 Uhr";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('12. Juli um 19:53 Uhr');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(7);
        expect(result.start.get('day')).toBe(12);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7-1, 12, 19, 53);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "5. Juni 12:00";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5. Juni 12:00');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(6);
        expect(result.start.get('day')).toBe(5);


        var resultDate = result.start.date();
        var expectDate = new Date(2012, 6-1, 5, 12, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

/*
// TODO: in these cases, the DEMonthNameParser is used (the incorrect date is ignored)
// TODO: interpret as full date
test("Test - Impossible Dates (Strict Mode)", function() {
 
    var text = "32. Dezember 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "29. Februar 2014";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "32. August";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "32. Oktober";
    var results = chrono.strict.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "29. Februar";
    var results = chrono.strict.parse(text, new Date(2013,7,10));
    expect(results.length).toBe(0)

});*/

test("Test - Impossible Dates (Casual Mode)", function() {
 
    var text = "32. Oktober 2015";
    var expectDate = new Date(2015, 10, 1, 12, 0);
    var results = chrono.de.parse(text);
    var resultDate = results[0].start.date();
    expect(results.length).toBe(1);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
});
