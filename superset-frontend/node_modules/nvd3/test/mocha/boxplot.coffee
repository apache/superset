describe 'NVD3', ->
    describe 'Box Plot', ->
        sampleData1 = [
            label: 'Sample A',
            values:  
                Q1: 120,
                Q2: 150,
                Q3: 200,
                whisker_low: 115,
                whisker_high: 210,
                outliers: [50, 100, 225]
        ]

        sampleData2 = [
            label: 'Sample A',
            values:  
                Q1: 120,
                Q2: 150,
                Q3: 200,
                whisker_low: 115,
                whisker_high: 210,
                outliers: []
        ]

        sampleData3 = [ 
            { 
              label: 'Sample A', 
              values: { Q1: 120, Q2: 150, Q3: 200, whisker_low: 115, whisker_high: 210, outliers: [50, 100, 225] } 
            },
            { 
              label: 'Sample B', 
              values: { Q1: 300, Q2: 350, Q3: 400, whisker_low: 2255, whisker_high: 400, outliers: [175] } 
            }
        ]

        sampleData4 = [
            label: 'Sample A',
            values:  
                Q1: -3,
                Q2: -2,
                Q3: -1,
                whisker_low: -5,
                whisker_high: 0,
                outliers: [-10, 10]
        ]
        
        options =
            x: (d)-> d.label
            y: (d)-> d.values.Q3
            margin:
                top: 30
                right: 20
                bottom: 50
                left: 75
            color: nv.utils.defaultColor()
            height: 400
            width: 800
            showXAxis: true
            showYAxis: true
            noData: 'No Data Available'
            duration: 0
            maxBoxWidth: 75
            
        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

            builder.model.update()

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-boxPlotWithAxes'
            should.exist wrap[0]

        it 'no data text', ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.build options, []

            noData = builder.$ '.nv-noData'
            noData[0].textContent.should.equal 'No Data Available'

        it 'has correct structure', ->
          cssClasses = [
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-barsWrap'
            '.nv-wrap'
            '.nv-boxplot'
            '.nv-boxplot-median'
            '.nv-boxplot-tick.nv-boxplot-low'
            '.nv-boxplot-whisker.nv-boxplot-low'
            '.nv-boxplot-tick.nv-boxplot-high'
            '.nv-boxplot-whisker.nv-boxplot-high'
          ]
          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-boxPlotWithAxes #{cssClass}")[0]

        it 'Has boxplots', ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.buildover options, sampleData3, []

            boxes = builder.$ '.nv-boxplot-box'
            boxes.length.should.equal 2, 'boxplots exist'

        it 'Has outliers', ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.buildover options, sampleData1, []

            outliers = builder.$ '.nv-boxplot .nv-boxplot-outlier'
            outliers.length.should.equal 3, 'outliers exist'

        it 'Has no outliers', ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.buildover options, sampleData2, []

            outliers = builder.$ '.nv-boxplot-outlier'
            outliers.length.should.equal 0, 'empty outliers'

        it 'Displays whiskers whose value are <= 0', ->
            builder = new ChartBuilder nv.models.boxPlotChart()
            builder.buildover options, sampleData4, []

            whiskers = builder.$ '.nv-boxplot-whisker'
            whiskers.length.should.equal 2, 'zero whiskers'
