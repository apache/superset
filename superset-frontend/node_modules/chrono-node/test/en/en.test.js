var chrono = require('../../src/chrono');


test("Test - Date + Time Expression", function() {

    var text = "Something happen on 2014-04-18 13:00 - 16:00 as";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1)
    expect(results[0].text).toBe('2014-04-18 13:00 - 16:00')
    
});


test("Test - Compare with native js", function() {

    var text = 'Sat Nov 05 1994 22:45:30 GMT+0900 (JST)';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);
    
    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())


    var text = 'Fri, 31 Mar 2000 07:00:00 UTC';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);
    
    expect(result.text).toBe(text);
    expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())

    var text = '2014-12-14T18:22:14.759Z';
    var result = chrono.parse(text)[0];
    var expected = new Date(text);
    
    expect(result.text).toBe(text);
    expect(Math.abs(expected.getTime() - result.start.date().getTime())).toBe(0)
});

test("Test - Implying timezeon", function() {
    
        var text = 'Sat Nov 05 1994 22:45:30 GMT+0900 (JST)';
        var result = chrono.parse(text)[0];
        var expected = new Date(text);
        
        expect(result.text).toBe(text);
        expect(expected.getTime()).toBeCloseTo(result.start.date().getTime())

        var impliedResult = chrono.parse('Sat Nov 05 1994 22:45:30')[0];
        impliedResult.start.imply('timezoneOffset', 540);

        expect(expected.getTime()).toBeCloseTo(impliedResult.start.date().getTime());
});

test('Test - Random text', function() { 

    var text = "Adam <Adam@supercalendar.com> написал(а):\nThe date is 02.07.2013";
    var result = chrono.parse(text, new Date(2013,5,22,3,33))[0];
    expect(result.text).toBe('02.07.2013')

    var text = "174 November 1,2001- March 31,2002";
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].text).toBe('November 1,2001- March 31,2002')


    var text = "...Thursday, December 15, 2011 Best Available Rate "
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].start.get('year')).toBe(2011)

    
    var text = "SUN 15SEP 11:05 AM - 12:50 PM"
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].text.length).toBe(29)
	
    var text = "SUN 15SEP 11:05 AM – 12:50 PM"
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].end).not.toBeNull()
    
    var text = "FRI 13SEP 1:29 PM - FRI 13SEP 3:29 PM"
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].start.get('hour')).toBe(13)
    expect(results[0].end.get('hour')).toBe(15)

    var text = "9:00 AM to 5:00 PM, Tuesday, 20 May 2013"
    var results = chrono.parse(text);
    expect(results.length).toBe(1)
    expect(results[0].start.get('hour')).toBe(9)
    expect(results[0].end.get('hour')).toBe(17)
    expect(results[0].end.get('meridiem')).toBe(1)


    var resultDate = results[0].start.date();
    var expectDate = new Date(2013, 4, 20, 9, 0);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
    var resultDate = results[0].end.date();
    var expectDate = new Date(2013, 4, 20, 17, 0);
    expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())

    var text = "2014-07-07T04:00:00Z"
    var results = chrono.parse(text);

    expect(results.length).toBe(1)
    expect(results[0].text).toBe('2014-07-07T04:00:00Z')


    var text = "1.5.3 - 2015-09-24";
    var results = chrono.parse(text);

    expect(results.length).toBe(1)
    expect(results[0].text).toBe('2015-09-24')


    var text = "1.5.30 - 2015-09-24";
    var results = chrono.parse(text);

    expect(results.length).toBe(1)
    expect(results[0].text).toBe('2015-09-24')


    var text = "1.50.30 - 2015-09-24";
    var results = chrono.parse(text);

    expect(results.length).toBe(1)
    expect(results[0].text).toBe('2015-09-24')

    var text = "Monday afternoon to last night";
    var results = chrono.parse(text, new Date(2017, 7-1, 7));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('Monday afternoon to last night');
    expect(results[0].start.get('day')).toBe(3);
    expect(results[0].start.get('month')).toBe(7);

    var text = "tonight to Thursday";
    var results = chrono.parse(text, new Date(2017, 7-1, 7));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('tonight to Thursday');
    expect(results[0].end.get('day')).toBe(13);
    expect(results[0].end.get('month')).toBe(7);

    var text = 'August 12, 2015 to 13 September';
    var results = chrono.parse(text, new Date(2017, 7-1, 7));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('August 12, 2015 to 13 September');
    expect(results[0].end.get('day')).toBe(13);
    expect(results[0].end.get('month')).toBe(9);
    expect(results[0].end.get('year')).toBe(2015);

    var text = 'from 10am to now';
    var results = chrono.parse(text, new Date(2017, 7-1, 7, 15));

    expect(results.length).toBe(1);
    expect(results[0].text).toBe('from 10am to now');
    expect(results[0].end.get('hour')).toBe(15);
    expect(results[0].end.get('minute')).toBe(0);
})

test("Test - Random non-date patterns", function() {

    var text = ' 3'
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = '       1'
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = '  11 '
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = ' 0.5 '
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = ' 35.49 '
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = '12.53%'
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "6358fe2310> *5.0* / 5 Outstanding";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "6358fe2310> *1.5* / 5 Outstanding";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "Total: $1,194.09 [image: View Reservation";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "Version: 1.1.3";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "Version: 1.1.30";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

    var text = "Version: 1.10.30";
    var results = chrono.parse(text);
    expect(results.length).toBe(0)

});


test("Test - Wikipedia Texts", function() {
    
    var text = 'October 7, 2011, of which details were not revealed out of respect to Jobs\'s family.[239] Apple announced on the same day that they had no plans for a public service, but were encouraging "well-wishers" to send their remembrance messages to an email address created to receive such messages.[240] Sunday, October 16, 2011';
    var results = chrono.parse(text, new Date(2012,7,10));
    
    expect(results.length).toBe(2)
    expect(results.length).toBe(2)

    var result = results[0];
    if(result){
        expect(result.start.get('year')).toBe(2011);
        expect(result.start.get('month')).toBe(10);
        expect(result.start.get('day')  ).toBe(7);

        expect(result.index).toBe(0)
        expect(result.text).toBe('October 7, 2011')
    }
    
    var result = results[1];
    if(result){
        expect(result.start.get('year')).toBe(2011);
        expect(result.start.get('month')).toBe(10);
        expect(result.start.get('day')  ).toBe(16);

        expect(result.index).toBe(297)
        expect(result.text).toBe('Sunday, October 16, 2011')
    }
    
});




