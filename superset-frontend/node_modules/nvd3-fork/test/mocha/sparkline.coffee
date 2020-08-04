describe 'NVD3', ->
    describe 'Sparkline Chart', ->
        sampleData1 = [
            {x: 1, y: 100}
            {x: 2, y: 101}
            {x: 3, y: 99}
            {x: 4, y: 56}
            {x: 5, y: 87}
        ]

        options =
            x: (d)-> d.x
            y: (d)-> d.y
            margin:
                top: 30
                right: 20
                bottom: 50
                left: 75
            width: 200
            height: 50
            xTickFormat: (d)-> d
            yTickFormat: (d)-> d.toFixed 2
            showLastValue: true
            alignValue: true
            rightAlignValue: false
            noData: 'No Data Available'

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.sparklinePlus()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

        it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.sparklinePlus()
            builder.buildover options, sampleData1, []
            
            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-sparklineplus'
            should.exist wrap[0]



        it 'has correct structure', ->
          cssClasses = [
            '.nv-sparklineWrap'
            '.nv-sparkline'
            '.nv-minValue'
            '.nv-maxValue'
            '.nv-currentValue'
            '.nv-valueWrap'
          ]
          for cssClass in cssClasses
            do(cssClass) ->
              should.exist builder.$("g.nvd3.nv-sparklineplus #{cssClass}")[0]