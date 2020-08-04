var chrono = require('../../src/chrono');
test('Test - Random text', function() { 

    var text = "...Donnerstag, 15. Dezember 2011 Best Available Rate "
    var results = chrono.parse(text);
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].start.get('day')).toBe(15)
    expect(results[0].start.get('month')).toBe(12)
    expect(results[0].start.get('year')).toBe(2011)


    var text = "9:00 bis 17:00, Dienstag, 20. Mai 2013"
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].start.get('hour')).toBe(9)
    expect(results[0].end.get('hour')).toBe(17)
    expect(results[0].end.get('meridiem')).toBe(1)
    expect(results[0].end.get('day')).toBe(20)
    expect(results[0].end.get('month')).toBe(5)
    expect(results[0].end.get('year')).toBe(2013)
});


test('Test - German support in default setting', function() {

    // German's formal text should be handle by default casual and strict

    var text = "9:00 bis 17:00, Dienstag, 20. Mai 2013";

    var results = chrono.parse(text);
    expect(results.length).toBe(1);

    var results = chrono.strict.parse(text);
    expect(results.length).toBe(1);

    var results = chrono.de.parse(text);
    expect(results.length).toBe(1);

    // German's casual text (e.g. "do" is abbreviation of "Donnerstag")should be skipped

    var text = "Do";

    var results = chrono.parse(text);
    expect(results.length).toBe(0);

    var results = chrono.strict.parse(text);
    expect(results.length).toBe(0);

    var results = chrono.de.parse(text);
    expect(results.length).toBe(1);
});
