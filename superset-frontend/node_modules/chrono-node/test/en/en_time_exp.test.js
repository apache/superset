var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {


    var text = "8:10";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('8:10');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(8);
        expect(result.start.get('minute')).toBe(10);


        expect(result.start.isCertain('day')).toBe(false);
        expect(result.start.isCertain('month')).toBe(false);
        expect(result.start.isCertain('year')).toBe(false);
        expect(result.start.isCertain('hour')).toBe(true);
        expect(result.start.isCertain('minute')).toBe(true);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "8:10 PM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('8:10 PM');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(20);
        expect(result.start.get('minute')).toBe(10);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 20, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "1230pm";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('1230pm');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(12);
        expect(result.start.get('minute')).toBe(30);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 30);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
	
    var text = "5:16p";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5:16p');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(17);
        expect(result.start.get('minute')).toBe(16);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5:16 p.m.";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5:16 p.m.');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(17);
        expect(result.start.get('minute')).toBe(16);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);


      var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 17, 16);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Lets meet at 6.13 AM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(10);
        expect(result.text).toBe('at 6.13 AM');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(6);
        expect(result.start.get('minute')).toBe(13);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 6, 13);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = '1-3pm';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('1-3pm');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 13, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
    
        expect(result.end).not.toBeNull();
        expect(result.end.get('hour')).toBe(15);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('meridiem')).toBe(1);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 15, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = '11pm-2';
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('11pm-2');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(23);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 23, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
    
        expect(result.end).not.toBeNull();
        expect(result.end.get('hour')).toBe(2);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('meridiem')).toBe(0);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 11, 2, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});

test("Test - Range Expression", function() {

    var text = "8:10 - 12.32";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('8:10 - 12.32');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(8);
        expect(result.start.get('minute')).toBe(10);

        expect(result.start.isCertain('day')).toBe(false);
        expect(result.start.isCertain('month')).toBe(false);
        expect(result.start.isCertain('year')).toBe(false);
        expect(result.start.isCertain('hour')).toBe(true);
        expect(result.start.isCertain('minute')).toBe(true);
        expect(result.start.isCertain('second')).toBe(false);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 8, 10);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        
        expect(result.end).not.toBeNull();
        expect(result.end.get('hour')).toBe(12);
        expect(result.end.get('minute')).toBe(32);

        expect(result.end.isCertain('day')).toBe(false);
        expect(result.end.isCertain('month')).toBe(false);
        expect(result.end.isCertain('year')).toBe(false);
        expect(result.end.isCertain('hour')).toBe(true);
        expect(result.end.isCertain('minute')).toBe(true);
        expect(result.end.isCertain('second')).toBe(false);
        expect(result.end.isCertain('millisecond')).toBe(false);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 12, 32);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = " from 6:30pm to 11:00pm ";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('from 6:30pm to 11:00pm');

        expect(result.start).not.toBeNull();
        expect(result.start.get('hour')).toBe(18);
        expect(result.start.get('minute')).toBe(30);
        expect(result.start.get('meridiem')).toBe(1);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 18, 30);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());
        
        expect(result.end).not.toBeNull();
        expect(result.end.get('hour')).toBe(23);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('meridiem')).toBe(1);

        var resultDate = result.end.date();
        var expectDate = new Date(2012, 7, 10, 23, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

});

test("Test - Impossible", function() {

    var text = "8:62";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "25:12";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0);

    var text = "13.12 PM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(0)
});

test("Test - Date + Time Expression", function() {

    var text = "Something happen on 2014-04-18 3.00 AM";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe('2014-04-18 3.00 AM');

        expect(result.start.get('year')).toBe(2014);
        expect(result.start.get('month')).toBe(4);
        expect(result.start.get('day')).toBe(18);
        expect(result.start.get('hour')).toBe(3);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 3, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Something happen on August 10, 2012 10:12:59 pm";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe('August 10, 2012 10:12:59 pm');

        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(22);
        expect(result.start.get('minute')).toBe(12);
        expect(result.start.get('second')).toBe(59);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 22, 12, 59);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "Something happen on 2014-04-18 7:00 - 8:00 AM...";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe('2014-04-18 7:00 - 8:00 AM');

        expect(result.start.get('year')).toBe(2014);
        expect(result.start.get('month')).toBe(4);
        expect(result.start.get('day')).toBe(18);
        expect(result.start.get('hour')).toBe(7);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(0);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 7, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());


        expect(result.end.get('year')).toBe(2014);
        expect(result.end.get('month')).toBe(4);
        expect(result.end.get('day')).toBe(18);
        expect(result.end.get('hour')).toBe(8);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.get('meridiem')).toBe(0);
        expect(result.end.isCertain('millisecond')).toBe(false);

        var resultDate = result.end.date();
        var expectDate = new Date(2014, 4-1, 18, 8, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "Something happen on 2014-04-18 7:00 - 8:00 PM...";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(20);
        expect(result.text).toBe('2014-04-18 7:00 - 8:00 PM');

        expect(result.start.get('year')).toBe(2014);
        expect(result.start.get('month')).toBe(4);
        expect(result.start.get('day')).toBe(18);
        expect(result.start.get('hour')).toBe(19);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);
        expect(result.start.isCertain('millisecond')).toBe(false);

        var resultDate = result.start.date();
        var expectDate = new Date(2014, 4-1, 18, 19, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime());


        expect(result.end.get('year')).toBe(2014);
        expect(result.end.get('month')).toBe(4);
        expect(result.end.get('day')).toBe(18);
        expect(result.end.get('hour')).toBe(20);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.get('meridiem')).toBe(1);
        expect(result.end.isCertain('millisecond')).toBe(false);

        var resultDate = result.end.date();
        var expectDate = new Date(2014, 4-1, 18, 20, 0);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }
});


test("Test - Time Expression's Meridiem imply", function() {

    var text = "1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('1pm-3');

        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);
        expect(result.start.isCertain('meridiem')).toBe(true);

        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(11);
        expect(result.end.get('hour')).toBe(3);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "2014-04-18 1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('2014-04-18 1pm-3');

        expect(result.start.get('year')).toBe(2014);
        expect(result.start.get('month')).toBe(4);
        expect(result.start.get('day')).toBe(18);
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);
        expect(result.start.isCertain('meridiem')).toBe(true);

        expect(result.end.get('year')).toBe(2014);
        expect(result.end.get('month')).toBe(4);
        expect(result.end.get('day')).toBe(19);
        expect(result.end.get('hour')).toBe(3);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "today from 1pm-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('today from 1pm-3');

        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(13);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(1);
        expect(result.start.isCertain('meridiem')).toBe(true);

        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(11);
        expect(result.end.get('hour')).toBe(3);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.isCertain('meridiem')).toBe(false)
    }

    var text = "today from 1am-3";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0);
        expect(result.text).toBe('today from 1am-3');

        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(10);
        expect(result.start.get('hour')).toBe(1);
        expect(result.start.get('minute')).toBe(0);
        expect(result.start.get('second')).toBe(0);
        expect(result.start.get('millisecond')).toBe(0);
        expect(result.start.get('meridiem')).toBe(0);
        expect(result.start.isCertain('meridiem')).toBe(true);

        expect(result.end.get('year')).toBe(2012);
        expect(result.end.get('month')).toBe(8);
        expect(result.end.get('day')).toBe(10);
        expect(result.end.get('hour')).toBe(3);
        expect(result.end.get('minute')).toBe(0);
        expect(result.end.get('second')).toBe(0);
        expect(result.end.get('millisecond')).toBe(0);
        expect(result.end.isCertain('meridiem')).toBe(false)
    }
});


test("Test - Timezone extraction", function() {

    var text = "friday at 2 pm";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);
    expect(result.start.isCertain('timezoneOffset')).toBe(false);
    expect(!result.start.get('timezoneOffset')).not.toBeNull();


    var text = "friday at 2 pm EST";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);
    expect(result.start.isCertain('timezoneOffset')).toBe(true);
    expect(result.start.get('timezoneOffset')).toBe(-300);


    var text = "friday at 2 pm est";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);
    expect(result.start.isCertain('timezoneOffset')).toBe(true);
    expect(result.start.get('timezoneOffset')).toBe(-300);


    var text = "friday at 2 pm establish ...";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe('friday at 2 pm');
    expect(result.start.isCertain('timezoneOffset')).toBe(false);
    expect(!result.start.get('timezoneOffset')).not.toBeNull();


    var text = "friday at 2 pm I will do something";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe('friday at 2 pm');
    expect(result.start.isCertain('timezoneOffset')).toBe(false);
    expect(!result.start.get('timezoneOffset')).not.toBeNull()
});


test("Test - Timezone extraction override", function() {

    var text = "friday at 2 pm IST";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);
    expect(result.start.isCertain('timezoneOffset')).toBe(true);
    expect(result.start.get('timezoneOffset')).toBe(330);

    var options = { timezones: { 'IST' : 60 }};
    var text = "friday at 2 pm IST";
    var result = chrono.parse(text, new Date(2016, 3, 28), options)[0];
    expect(result.text).toBe(text);
    expect(result.start.isCertain('timezoneOffset')).toBe(true);
    expect(result.start.get('timezoneOffset')).toBe(60);
});

test("Test - Milliseconds", function() {
    
    var text = "friday at 10:31:50.522 - 10:45:50.122 pm";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);

    expect(result.start.isCertain('millisecond')).toBe(true);
    expect(result.start.get('millisecond')).toBe(522);
    expect(result.start.get('second')).toBe(50);
    expect(result.start.get('minute')).toBe(31);
    expect(result.start.get('hour')).toBe(22);

    expect(result.end.isCertain('millisecond')).toBe(true);
    expect(result.end.get('millisecond')).toBe(122);
    expect(result.end.get('second')).toBe(50);
    expect(result.end.get('minute')).toBe(45);
    expect(result.end.get('hour')).toBe(22);


    var text = "friday at 10:31:50.522142 - 10:45:50.122124 pm";
    var result = chrono.parse(text, new Date(2016, 3, 28))[0];
    expect(result.text).toBe(text);

    expect(result.start.isCertain('millisecond')).toBe(true);
    expect(result.start.get('millisecond')).toBe(522);
    expect(result.start.get('second')).toBe(50);
    expect(result.start.get('minute')).toBe(31);
    expect(result.start.get('hour')).toBe(22);

    expect(result.end.isCertain('millisecond')).toBe(true);
    expect(result.end.get('millisecond')).toBe(122);
    expect(result.end.get('second')).toBe(50);
    expect(result.end.get('minute')).toBe(45);
    expect(result.end.get('hour')).toBe(22)


});

test("Test - Random date + time expression", function() {

    var text = "monday 4/29/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    
    var text = "wednesday 5/1/2013 1115am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    
    var text = "friday 5/3/2013 1230pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    
    var text = "sunday 5/6/2013  750am-910am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "monday 5/13/2013 630-930am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "wednesday 5/15/2013 1030am";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "friday 6/21/2013 2:30";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "tuesday 7/2/2013 1-230 pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "Monday, 6/24/2013, 7:00pm - 8:30pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "Thursday6/20/2013 from 7:00 PM to 10:00 PM";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "Wednesday, July 03, 2013 2pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);


    var text = "6pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "6 pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "7-10pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "11.1pm";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "that I need to know or am I covered?";
    var result = chrono.parse(text);
    expect(result.length).toBe(0);

    var text = "at 12";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "at noon";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);
    expect(result.start.get('hour')).toBe(12);
    expect(result.start.get('hour')).toBe(12);

    var text = "at midnight";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "at 7 oclock";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "at 7 o clock";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "at 7 o'clock";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text);

    var text = "at 7-8 o'clock";
    var result = chrono.parse(text)[0];
    expect(result.text).toBe(text)
});