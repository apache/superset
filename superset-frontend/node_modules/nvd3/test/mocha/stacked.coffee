describe 'NVD3', ->
    describe 'Stacked Area Chart', ->
        sampleData1 = [
            key: 'Series 1'
            values: [
                [-1,-1]
                [0,0]
                [1,1]
                [2,2]
            ]
        ]

        sampleData2 = [
            key: 'Series 1'
            values: [
                [-1,-3]
                [0,6]
                [1,12]
                [2,18]
            ]
        ,
            key: 'Series 2'
            values: [
                [-1,-4]
                [0,7]
                [1,13]
                [2,14]
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
            showLegend: true
            showControls: true
            showXAxis: true
            showYAxis: true
            rightAlignYAxis: false
            useInteractiveGuideline: true
            noData: 'No Data Available'
            duration: 0
            controlLabels:
                stacked: 'Stacked'
                stream: 'Stream'
                expanded: 'Expanded'

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.stackedAreaChart()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-stackedAreaChart'
            should.exist wrap[0]

        it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.stackedAreaChart()
            builder.buildover options, sampleData1, []

            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'

        it 'has correct structure', ->
          cssClasses = [
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-stackedWrap'
            '.nv-legendWrap'
            '.nv-controlsWrap'
            '.nv-interactive'
          ]

          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-stackedAreaChart #{cssClass}")[0]

        it 'formats y-Axis correctly depending on stacked style', ->
            chart = nv.models.stackedAreaChart()
            chart.yAxis.tickFormat (d)-> "<#{d}>"

            builder = new ChartBuilder chart
            builder.build options, sampleData1

            yTicks = builder.$ '.nv-y.nv-axis .tick text'
            yTicks.should.have.length.greaterThan 2

            for tick in yTicks
                tick.textContent.should.match /<.*?>/

            # Update chart to 'Expand' mode
            chart.dispatch.changeState
                style: 'expand'

            chart.stacked.style().should.equal 'expand'
            newTickFormat = chart.yAxis.tickFormat()
            newTickFormat(1).should.equal '100%'

            chart.dispatch.changeState
                style: 'stacked'

            chart.stacked.style().should.equal 'stacked'
            newTickFormat = chart.yAxis.tickFormat()
            newTickFormat(1).should.equal '<1>'

        it 'can override axis ticks', ->
            builder.model.xAxis.ticks(34)
            builder.model.yAxis.ticks(56)
            builder.model.update()
            builder.model.xAxis.ticks().should.equal 34
            builder.model.yAxis.ticks().should.equal 56

        it 'if stacked.offset is "wiggle", y ticks is zero', ->
            builder.model.stacked.offset 'wiggle'
            builder.model.update()
            builder.model.yAxis.ticks().should.equal 0

        it 'should set color property if not specified', ->
            sampleData3 = [
              key: 'Series 1'
              values: [
                [-1,-1]
                [0,0]
                [1,1]
                [2,2]
              ]
            ]
            builder.build options, sampleData3
            should.exist sampleData3[0].color
