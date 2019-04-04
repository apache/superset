describe 'NVD3', ->
  describe 'Utils', ->
    objects = [
      'nv.utils.windowSize'
      'nv.utils.windowResize'
      'nv.utils.getColor'
      'nv.utils.defaultColor'
      'nv.utils.customTheme'
      'nv.utils.pjax'
      'nv.utils.calcApproxTextWidth'
      'nv.utils.NaNtoZero'
      'nv.utils.renderWatch'
      'nv.utils.deepExtend'
      'nv.utils.state'
      'nv.utils.optionsFunc'
      'nv.utils.sanitizeHeight'
      'nv.utils.sanitizeWidth'
      'nv.utils.availableHeight'
      'nv.utils.availableWidth'
      'nv.utils.noData'
    ]

    describe 'has ', ->
      for obj in objects
        it " #{obj} object", ->
          should.exist eval obj

    it 'has working nv.utils.NaNtoZero function', ->
      nv.utils.NaNtoZero().should.be.equal 0
      nv.utils.NaNtoZero(undefined ).should.be.equal 0
      nv.utils.NaNtoZero(NaN).should.be.equal 0
      nv.utils.NaNtoZero(null).should.be.equal 0
      nv.utils.NaNtoZero(Infinity).should.be.equal 0
      nv.utils.NaNtoZero(-Infinity).should.be.equal 0
      nv.utils.NaNtoZero(1).should.be.equal 1
      nv.utils.NaNtoZero(0).should.be.equal 0
      nv.utils.NaNtoZero(-1).should.be.equal -1

    it 'should return a function if passing a function into nv.utils.getColor', ->
      uno = (d,i) -> 1
      nv.utils.getColor(uno).should.be.equal uno

    it 'should return a function wrapping an array if passing an array into nv.utils.getColor', ->
      arr = ['#fff', '#ccc', '#aaa', '#000']
      returnedFunction = nv.utils.getColor(arr)

      returnedFunction({},0).should.be.equal '#fff'
      returnedFunction({},1).should.be.equal '#ccc'
      returnedFunction({},2).should.be.equal '#aaa'
      returnedFunction({},3).should.be.equal '#000'

  createCont = (wh = false)->
    obj = document.createElement('div')
    obj.style.cssText = 'width:964px;height:404px' if wh
    d3.select(obj)

  describe 'Sanitize Height and Width for a Container', ->
    it 'provides default height and width', ->
      cont = createCont()
      expect(nv.utils.sanitizeHeight(null, cont)).to.equal 400
      expect(nv.utils.sanitizeWidth(null, cont)).to.equal 960
      expect(nv.utils.sanitizeHeight(undefined, cont)).to.equal 400
      expect(nv.utils.sanitizeWidth(undefined, cont)).to.equal 960
      expect(nv.utils.sanitizeHeight(0, cont)).to.equal 400
      expect(nv.utils.sanitizeWidth(0, cont)).to.equal 960
    it 'uses container width and height', ->
      cont = createCont(true)
      expect(nv.utils.sanitizeHeight(null, cont)).to.equal 404
      expect(nv.utils.sanitizeWidth(null, cont)).to.equal 964
    it 'uses given width and height', ->
      cont = createCont(true)
      expect(nv.utils.sanitizeHeight(408, cont)).to.equal 408
      expect(nv.utils.sanitizeWidth(968, cont)).to.equal 968

  describe 'Available Container Height and Width', ->
    it 'calculates height and width properly', ->
      cont = createCont(true)
      m = { left: 5, right: 6, top: 7, bottom: 8 }
      expect(nv.utils.availableHeight(300, cont, m)).to.equal 285
      expect(nv.utils.availableWidth(300, cont, m)).to.equal 289
      expect(nv.utils.availableHeight(0, cont, m)).to.equal 389
      expect(nv.utils.availableWidth(0, cont, m)).to.equal 953

  describe 'Interactive Bisect', ->
    it 'works with no accessor', ->
      list = [{ x:0 },{ x:1 },{ x:1 },{ x:2 },{ x:3 },{ x:5 },{ x:8 },{ x:13 },{ x:21 },{ x:34 }]
      expect(nv.interactiveBisect(list,7)).to.equal 6

    runTest = (list, searchVal, accessor = null)->
      xAcc = unless accessor?
        (d)-> d
      else
        accessor

      nv.interactiveBisect list, searchVal, xAcc

    it 'exists', ->
      expect(nv.interactiveBisect).to.exist

    it 'returns null when no array', ->
      expect(nv.interactiveBisect('bad', 'a')).to.equal null

    it 'basic test', ->
      expect(runTest([0,1,2,3,4,5], 3)).to.equal 3

    it 'zero bound', ->
      expect(runTest([0,1,2,3,4,5], 0)).to.equal 0

    it 'length bound', ->
      expect(runTest([0,1,2,3,4,5], 5)).to.equal 5

    it 'negative number', ->
      expect(runTest([0,1,2,3,4,5], -4)).to.equal 0

    it 'past the end', ->
      expect(runTest([0,1,2,3,4,5], 10)).to.equal 5

    it 'floating point number 1', ->
      expect(runTest([0,1,2,3,4,5], 0.34)).to.equal 0

    it 'floating point number 2', ->
      expect(runTest([0,1,2,3,4,5], 1.50001)).to.equal 2

    it 'fibonacci - existing', ->
      list = [0,1,1,2,3,5,8,13,21,34]
      expect(runTest(list,8)).to.equal 6

    it 'fibonacci - inbetween item (left)', ->
      list = [0,1,1,2,3,5,8,13,21,34]
      expect(runTest(list,15)).to.equal 7

    it 'fibonacci - inbetween item (right)', ->
      list = [0,1,1,2,3,5,8,13,21,34]
      expect(runTest(list,20)).to.equal 8

    it 'empty array', ->
      expect(runTest([],4)).to.equal 0

    it 'single element array', ->
      expect(runTest([0],0)).to.equal 0

    it 'single element array - negative bound', ->
      expect(runTest([0],-4)).to.equal 0

    it 'single element array - past the end', ->
      expect(runTest([0],1)).to.equal 0

  describe 'NoData Chart Clearing', ->
    sampleData1 = [
            key: 'Series 1'
            values: [
                [-1,-1]
                [0,0]
                [1,1]
                [2,2]
            ]
        ]

    options =
            x: (d)-> d[0]
            y: (d)-> d[1]
            margin:
                top: 30
                right: 20
                bottom: 50
                left: 75
            color: nv.utils.defaultColor()
            height: 400
            width: 800
            showLegend: true
            showXAxis: true
            showYAxis: true
            rightAlignYAxis: true
            useInteractiveGuideline: true
            noData: 'No Data Available'
            duration: 0
            clipEdge: false
            isArea: (d)-> d.area
            defined: (d)-> true
            interpolate: 'linear'

    it 'shows no data text', ->
            builder = new ChartBuilder nv.models.lineChart()
            builder.build options, []

            noData = builder.$ '.nv-noData'
            noData[0].textContent.should.equal 'No Data Available'

    it 'clears chart objects for no data', ->
        builder = new ChartBuilder nv.models.lineChart()
        builder.buildover options, sampleData1, []
        
        groups = builder.$ 'g'
        groups.length.should.equal 0, 'removes chart components'
