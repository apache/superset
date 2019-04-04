describe 'NVD3', ->
    describe 'Discrete Bar Chart', ->
        sampleData1 = [
            key: 'Series 1'
            values: [
                {label: 'America', value: 100}
                {label: 'Europe', value: 200}
                {label: 'Asia', value: 50}
                {label: 'Africa', value: 70}
            ]
        ]

        options =
            x: (d)-> d.label
            y: (d)-> d.value
            margin:
                top: 30
                right: 20
                bottom: 50
                left: 75
            color: nv.utils.defaultColor()
            showXAxis: true
            showYAxis: true
            rightAlignYAxis: false
            staggerLabels: true
            showValues: true
            valueFormat: (d)-> d.toFixed 2
            noData: 'No Data Available'
            duration: 0

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.discreteBarChart()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-discreteBarWithAxes'
            should.exist wrap[0]

        it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.discreteBarChart()
            builder.buildover options, sampleData1, []
            
            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'

        it 'has correct structure', ->
          cssClasses = [
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-barsWrap'
            '.nv-discretebar'
          ]
          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-discreteBarWithAxes #{cssClass}")[0]

        it 'can override axis ticks', ->
            builder.model.xAxis.ticks(34)
            builder.model.yAxis.ticks(56)
            builder.model.update()
            builder.model.xAxis.ticks().should.equal 34
            builder.model.yAxis.ticks().should.equal 56

