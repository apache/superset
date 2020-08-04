var chrono = require('../../src/chrono');
test("Test - fr - modifier mandatory just after", function() {

    var text = "le mois d'avril";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result).toBe(undefined);

    // The modifier "prochain" have to be just after the word "mois", to avoid this kind of cases we cannot handle
    var text = "le mois d'avril prochain";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result).toBe(undefined);

});

test("Test - fr - relative date", function() {

    var text = "la semaine prochaine";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(15);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(21);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "les 2 prochaines semaines";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(15);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(28);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "les trois prochaines semaines";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(15);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(6);
    expect(result.end.get('day')).toBe(4);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "le mois dernier";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(4);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(4);
    expect(result.end.get('day')).toBe(30);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "les 30 jours précédents";
    var result = chrono.parse(text, new Date(2017, 5-1, 12))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(4);
    expect(result.start.get('day')).toBe(12);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(11);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "les 24 heures passées";
    var result = chrono.parse(text, new Date(2017, 5-1, 12, 11, 27))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(11);
    expect(result.start.get('hour')).toBe(11);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(12);
    expect(result.end.get('hour')).toBe(10);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "les 90 secondes suivantes";
    var result = chrono.parse(text, new Date(2017, 5-1, 12, 11, 27, 0))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(12);
    expect(result.start.get('hour')).toBe(11);
    expect(result.start.get('minute')).toBe(27);
    expect(result.start.get('second')).toBe(1);
    expect(result.start.get('millisecond')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(12);
    expect(result.end.get('hour')).toBe(11);
    expect(result.end.get('minute')).toBe(28);
    expect(result.end.get('second')).toBe(30);
    expect(result.end.get('millisecond')).toBe(999);


    var text = "les huit dernieres minutes"; // No accent should work too
    var result = chrono.parse(text, new Date(2017, 5-1, 12, 11, 27))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(5);
    expect(result.start.get('day')).toBe(12);
    expect(result.start.get('hour')).toBe(11);
    expect(result.start.get('minute')).toBe(19);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(5);
    expect(result.end.get('day')).toBe(12);
    expect(result.end.get('hour')).toBe(11);
    expect(result.end.get('minute')).toBe(26);
    expect(result.end.get('second')).toBe(59);


    var text = "le dernier trimestre";
    var result = chrono.parse(text, new Date(2017, 5-1, 12, 11, 27))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2017);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2017);
    expect(result.end.get('month')).toBe(3);
    expect(result.end.get('day')).toBe(31);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);


    var text = "l'année prochaine";
    var result = chrono.parse(text, new Date(2017, 5-1, 12, 11, 27))[0];
    expect(result.text).toBe(text);
    expect(result.start.get('year')).toBe(2018);
    expect(result.start.get('month')).toBe(1);
    expect(result.start.get('day')).toBe(1);
    expect(result.start.get('hour')).toBe(0);
    expect(result.start.get('minute')).toBe(0);
    expect(result.start.get('second')).toBe(0);

    expect(result.end.get('year')).toBe(2018);
    expect(result.end.get('month')).toBe(12);
    expect(result.end.get('day')).toBe(31);
    expect(result.end.get('hour')).toBe(23);
    expect(result.end.get('minute')).toBe(59);
    expect(result.end.get('second')).toBe(59);

});
