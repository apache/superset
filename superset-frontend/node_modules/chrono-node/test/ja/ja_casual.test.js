var chrono = require('../../src/chrono');


test("Test - Single Expression", function() {

    var text = "今日感じたことを忘れずに";
    var results = chrono.parse(text, new Date(2012, 8-1, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('今日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(10)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 10, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }


    var text = "昨日の全国観測値ランキング";
    var results = chrono.parse(text, new Date(2012,8-1, 10, 12));
    expect(results.length).toBe(1)

    var result = results[0];
    if (result) {
        expect(result.index).toBe(0)
        expect(result.text).toBe('昨日')

        expect(result.start).not.toBeNull()
        expect(result.start.get('year')).toBe(2012)
        expect(result.start.get('month')).toBe(8)
        expect(result.start.get('day')).toBe(9)
        
        var resultDate = result.start.date();
        var expectDate = new Date(2012, 8-1, 9, 12);
        expect(expectDate.getTime()).toBeCloseTo(resultDate.getTime())
    }

    
});





