describe 'NVD3', ->
    describe 'Scatter Chart', ->
        sampleData1 = [
            key: 'Series 1'
            slope: 0.5
            intercept: 0.2
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
                right: 20
                bottom: 50
                left: 75
            width: 200
            height: 200
            color: nv.utils.defaultColor()
            showDistX: true
            showDistY: true
            showLegend: true
            showXAxis: true
            showYAxis: true
            rightAlignYAxis: false
            noData: 'No Data Available'
            duration: 0

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.scatterChart()
            builder.build options, sampleData1

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt], "#{opt} exists"
                should.exist builder.model[opt](), "#{opt} can be called"

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-scatterChart'
            should.exist wrap[0]

        it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.scatterChart()
            builder.buildover options, sampleData1, []

            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'

        it 'has correct structure', ->
          cssClasses = [
            '.nv-background'
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-scatterWrap'
            '.nv-distWrap'
            '.nv-legendWrap'
          ]

          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-scatterChart #{cssClass}")[0]

        it 'has data points', ->
            points = builder.$ '.nv-groups .nv-series-0 .nv-point'
            points.should.have.length 4

        it 'has a legend', ->
            legend = builder.$ '.nv-legendWrap'
            should.exist legend, 'legend exists'

        it 'shows no data message', ->
            builder.teardown()
            builder.build options, []

            noData = builder.$ 'text.nv-noData'
            should.exist noData[0]
            noData[0].textContent.should.equal 'No Data Available'

        it 'can update with new data', ->
            d3.select(builder.svg).datum(sampleData2)
            builder.model.update()

            points1 = builder.$ '.nv-groups .nv-series-0 .nv-point'
            points1.should.have.length 4

            points2 = builder.$ '.nv-groups .nv-series-1 .nv-point'
            points2.should.have.length 4

        it 'scatterPlusLineChart', ->
            builder.teardown()
            sampleData3 = [
                key: 'Series 1'
                values: [
                    [-1,-3]
                    [0,6]
                    [1,12]
                    [2,18]
                ]
                slope: 0.1
                inercept: 5
            ]

            builder.build options, sampleData3

            wrap = builder.$ 'g.nvd3.nv-scatterChart'
            should.exist wrap[0]

            lines = builder.$ 'g.nvd3 .nv-regressionLinesWrap .nv-regLines'
            should.exist lines[0], 'regression lines exist'

        it 'sets legend.width same as availableWidth', ->
            builder.model.legend.width()
            .should.equal builder.model.scatter.width()

        it 'translates nv-wrap after legend height calculated', ->
            builder.teardown()
            sampleData4 = []
            for i in [0..40]
                sampleData4.push
                    key: "Series #{i}"
                    values: [
                        [Math.random(),Math.random()]
                    ]

            builder.build options, sampleData4

            transform = builder.$('.nv-wrap')[0].getAttribute('transform')
            transform.should.equal 'translate(75,830)'

        it 'can override axis ticks', ->
            builder.model.xAxis.ticks(34)
            builder.model.yAxis.ticks(56)
            builder.model.update()
            builder.model.xAxis.ticks().should.equal 34
            builder.model.yAxis.ticks().should.equal 56

        it 'only appends one nv-point-clips group', (done)->
            builder2 = new ChartBuilder nv.models.scatterChart()

            builder2.build options, sampleData1

            window.setTimeout ->
                builder2.model.update()
                window.setTimeout((->
                    pointClips = builder2.svg.querySelector '.nv-point-clips'
                    should.exist pointClips, 'nv-point-clips exists'

                    builder2.svg.querySelector('.nv-wrap.nv-scatter')
                    .childElementCount.should.equal 3

                    builder2.teardown()
                    done()
                ), 500)

            , 500

        it 'sets nv-single-point class if only one data point', ->
            builder.teardown()

            singleData = [
                key: 'Series1'
                values: [
                    [1,1]
                ]
            ]

            builder.build options, singleData

            builder.svg.querySelector('.nv-wrap.nv-scatter')
            .className.should.contain 'nv-single-point'

            builder.updateData sampleData1

            builder.svg.querySelector('.nv-wrap.nv-scatter')
            .className.should.not.contain 'nv-single-point'

            builder.updateData singleData

            builder.svg.querySelector('.nv-wrap.nv-scatter')
            .className.should.contain 'nv-single-point'

        it 'should set color property if not specified', ->
            builder.teardown()

            singleData = [
                key: 'Series1'
                values: [
                  [1,1]
                ]
            ]

            builder.build options, singleData

            should.exist singleData[0].color
