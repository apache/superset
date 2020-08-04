var chrono = require('../../src/chrono');


test("Test - Single Expression", function() {

    var text = "主な株主（2012年3月31日現在）";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(5)
        expect(result.text).toBe('2012年3月31日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(3)
        expect(result.start.get('day')).toBe(31)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 3-1, 31, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 


    var text = "主な株主（2012年９月3日現在）";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(5)
        expect(result.text).toBe('2012年９月3日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(9)
        expect(result.start.get('day')).toBe(3)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 3, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 

    var text = "主な株主（９月3日現在）";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(5)
        expect(result.text).toBe('９月3日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(9)
        expect(result.start.get('day')).toBe(3)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 9-1, 3, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 

    var text = "主な株主（平成26年12月29日）";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(5)
        expect(result.text).toBe('平成26年12月29日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2014)
        expect(result.start.get('month')).toBe(12)
        expect(result.start.get('day')).toBe(29)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2014, 12-1, 29, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 

    var text = "主な株主（昭和６４年１月７日）";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(5)
        expect(result.text).toBe('昭和６４年１月７日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(1989)
        expect(result.start.get('month')).toBe(1)
        expect(result.start.get('day')).toBe(7)
        
        var resultDate = result.start.date();
        var expectDate = new Date(1989, 1-1, 7, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 

    
});


test("Test - Range Expression", function() {

    var text = "2013年12月26日-2014年1月7日";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('2013年12月26日-2014年1月7日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(12)
        expect(result.start.get('day')).toBe(26)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2013, 12-1, 26, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2014)
        expect(result.end.get('month')).toBe(1)
        expect(result.end.get('day')).toBe(7)
        
        var resultDate = result.end.date();
        var expectDate = new Date(2014, 1-1, 7, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    var text = "２０１３年１２月２６日ー2014年1月7日";
    var results = chrono.parse(text, new Date(2012,8-1,10));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('２０１３年１２月２６日ー2014年1月7日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2013)
        expect(result.start.get('month')).toBe(12)
        expect(result.start.get('day')).toBe(26)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2013, 12-1, 26, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    
        expect(result.end).not.toBeNull()
        expect(result.end.get('year')).toBe(2014)
        expect(result.end.get('month')).toBe(1)
        expect(result.end.get('day')).toBe(7)
        
        var resultDate = result.end.date();
        var expectDate = new Date(2014, 1-1, 7, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    } 

    
});





