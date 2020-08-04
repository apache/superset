describe 'NVD3', ->
    describe 'Line Chart', ->
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
            classed: 'dashed'
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
        ,
            key: 'Series 3'
            values: [
                [-1,-5]
                [0,7.2]
                [1,11]
                [2,18.5]
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

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.lineChart()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

            builder.model.update()

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-lineChart'
            should.exist wrap[0]

        it 'no data text', ->
            builder = new ChartBuilder nv.models.lineChart()
            builder.build options, []

            noData = builder.$ '.nv-noData'
            noData[0].textContent.should.equal 'No Data Available'

        it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.lineChart()
            builder.buildover options, sampleData1, []

            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'


        it 'has correct structure', ->
          cssClasses = [
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-linesWrap'
            '.nv-legendWrap'
            '.nv-line'
            '.nv-scatter'
            '.nv-legend'
          ]
          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-lineChart #{cssClass}")[0]

        it 'can override axis ticks', ->
            builder.model.xAxis.ticks(34)
            builder.model.yAxis.ticks(56)
            builder.model.update()
            builder.model.xAxis.ticks().should.equal 34
            builder.model.yAxis.ticks().should.equal 56

        it 'can add custom CSS class to series', ->
            builder.updateData sampleData2

            classed = builder.$ '.nv-linesWrap .nv-groups .nv-group.dashed'
            
            # Since classing has been implemented at the data-level for
            # scatter points, there will actually be 2 elements matching
            # the above selector, one for the scatter g element,
            # and one for the line.
            
            classed.length.should.equal 2, 'dashed class exists'

            scatter = builder.$ '.nv-scatterWrap .nv-groups .nv-group.dashed'
            scatter.length.should.equal 1, 'one classed element is from scatter'

        it 'shows focus chart when focusEnable is set to true', ->
            builder.model.focusEnable(true).update();
            focus = builder.$ '.nv-focusWrap .nv-focus'
            should.exist focus[0]

        it 'hides focus chart when focusEnable is set to false', ->
            builder.model.focusEnable(true).update();
            builder.model.focusEnable(false).update();
            focusWrap = builder.$ '.nv-focusWrap'
            focusWrap[0].style.display.should.equal 'none'

        it 'does not reset selected focus range when focusEnable is set to false', ->
            builder.model.focusEnable(true).update();
            builder.model.brushExtent([0, 1]).update();
            builder.model.focusEnable(false).update();
            builder.model.brushExtent()[0].should.equal 0
            builder.model.brushExtent()[1].should.equal 1

