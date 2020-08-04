var chrono = require('../../src/chrono');

test("Test - Single Expression", function() {

    var text = "五日內我地有d野做";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('五日內');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }



    var text = "5日之內我地有d野做";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5日之內');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(15);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 15, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "十日內我地有d野做";
    var results = chrono.parse(text, new Date(2012,7,10));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('十日內');

        expect(result.start).not.toBeNull();
        expect(result.start.get('year')).toBe(2012);
        expect(result.start.get('month')).toBe(8);
        expect(result.start.get('day')).toBe(20);

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 20, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "五分鐘後";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('五分鐘後');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "一個鐘之內";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('一個鐘之內');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,13,14);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "5分鐘之後我就收皮";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('5分鐘之後');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,19);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "係5秒之後你就會收皮";
    var results = chrono.parse(text, new Date(2012,7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(1);
        expect(result.text).toBe('5秒之後');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 10, 12, 14, 5);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "半小時之內";
    var results = chrono.parse(text, new Date(2012,7,10,12,14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('半小時之內');

        var resultDate = result.start.date();
        var expectDate = new Date(2012,7,10,12,44);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "兩個禮拜內答覆我";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('兩個禮拜內');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 7, 24, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "1個月之內答覆我";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('1個月之內');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "幾個月之內答覆我";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('幾個月之內');

        var resultDate = result.start.date();
        var expectDate = new Date(2012, 10, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "一年內答覆我";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('一年內');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "1年之內答覆我";
    var results = chrono.parse(text, new Date(2012, 7, 10, 12, 14));
    expect(results.length).toBe(1);

    var result = results[0];
    if(result){
        expect(result.index).toBe(0);
        expect(result.text).toBe('1年之內');

        var resultDate = result.start.date();
        var expectDate = new Date(2013, 7, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


});
