describe 'NVD3', ->
    describe 'Axis', ->
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

        axisOptions =
            margin:
                top: 0
                right: 0
                bottom: 0
                left: 0
            width: 75
            height: 60
            axisLabel: 'Date'
            showMaxMin: true
            scale: d3.scale.linear()
            rotateYLabel: true
            rotateLabels: 0
            staggerLabels: false
            axisLabelDistance: 12
            duration: 0

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.lineChart()
            builder.build options, sampleData1

            axis = builder.model.xAxis
            for opt, val of axisOptions
                axis[opt](val)

            builder.model.update()

        afterEach ->
            builder.teardown()

        it 'api check', ->
            axis = builder.model.xAxis

            for opt, val of axisOptions
                should.exist axis[opt](), "#{opt} can be called"

        it 'x axis structure', ->
            axis = builder.$ '.nv-x.nv-axis'

            should.exist axis[0], '.nv-axis exists'

            maxMin = builder.$ '.nv-x.nv-axis .nv-axisMaxMin'

            maxMin.should.have.length 2

            maxMin[0].textContent.should.equal  '-1'
            maxMin[1].textContent.should.equal '2'

            ticks = builder.$ '.nv-x.nv-axis .tick'

            ticks.should.have.length 2

            expected = [
                '0'
                '1'
            ]

            for tick,i in ticks
                tick.textContent.should.equal expected[i]

            axisLabel = builder.$ '.nv-x.nv-axis .nv-axislabel'
            should.exist axisLabel[0], 'axis label exists'
            axisLabel[0].textContent.should.equal 'Date'

        it 'y axis structure', ->
            axis = builder.$ '.nv-y.nv-axis'

            should.exist axis[0], '.nv-axis exists'

            maxMin = builder.$ '.nv-y.nv-axis .nv-axisMaxMin'

            maxMin.should.have.length 2

            maxMin[0].textContent.should.equal  '-1'
            maxMin[1].textContent.should.equal '2'

            ticks = builder.$ '.nv-y.nv-axis .tick'

            ticks.should.have.length 4

            expected = [
                '-1'
                '0'
                '1'
                '2'
            ]

            for tick,i in ticks
                tick.textContent.should.equal expected[i]

        it 'axis rotate labels', ->
            axis = builder.model.xAxis
            axis.rotateLabels 30
            builder.model.update()

            ticks = builder.$ '.nv-x.nv-axis .tick text'

            for tick in ticks
                transform = tick.getAttribute 'transform'
                transform.should.match /rotate\(30 0,\d+?.*?\)/

            maxMin = builder.$ '.nv-x.nv-axis .nv-axisMaxMin text'

            for tick in maxMin
                transform = tick.getAttribute 'transform'
                transform.should.match /rotate\(30 0,\d+?.*?\)/

        it 'axis stagger labels', ->
            axis = builder.model.xAxis
            axis.staggerLabels true
            builder.model.update()

            ticks = builder.$ '.nv-x.nv-axis .tick text'

            prevTransform = ''
            for tick, i in ticks
                transform = tick.getAttribute 'transform'

                transform.should.not.equal prevTransform
                transform.should.match /translate\(0,(12|0)\)/
                prevTransform = transform

        it 'axis orientation', (done)->
            axis = builder.model.xAxis
            axis.orient 'top'
            builder.model.update()

            axis.orient 'right'
            builder.model.update()

            done()

        it 'has CSS class "zero" to mark zero tick', ->
            tick = builder.$ '.nv-x.nv-axis .tick.zero'
            tick.length.should.equal 1, 'x axis zero'

            tick = builder.$ '.nv-y.nv-axis .tick.zero'
            tick.length.should.equal 1, 'y axis zero'

        it 'default tick format for max/min should be integer based', ->
            axis = builder.model.xAxis
            builder.model.update()
            minAxisText = builder.$('.nv-axisMaxMin.nv-axisMaxMin-x.nv-axisMin-x text')[0].textContent

            minAxisText.should.equal('-1')

        it 'tickFormatMaxMin should change tick format of max/min', ->
            axis = builder.model.xAxis
            axis.tickFormatMaxMin(d3.format(',.2f'))
            builder.model.update()
            minAxisText = builder.$('.nv-axisMaxMin.nv-axisMaxMin-x.nv-axisMin-x text')[0].textContent

            minAxisText.should.equal('-1.00')
