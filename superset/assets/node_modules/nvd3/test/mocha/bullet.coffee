describe 'NVD3', ->

    describe 'Bullet Chart', ->
        sampleData1 =
            title: 'Revenue'
            subtitle: 'US$ in thousands'
            ranges: [10,20,30]
            measures: [40]
            markers: [50, 100]

        options =
            orient: 'left'
            margin:
                top: 60
                right: 70
                bottom: 80
                left: 90
            color: nv.utils.defaultColor()
            ranges: (d)-> d.ranges
            markers: (d)-> d.markers
            measures: (d)-> d.measures
            width: 100
            height: 110
            tickFormat: (d)-> d.toFixed 2
            noData: 'No Data Available'

        builder1 = null
        beforeEach ->
            builder1 = new ChartBuilder nv.models.bulletChart()
            builder1.build options, sampleData1

        afterEach ->
            builder1.teardown()

        it 'api check', ->
          should.exist builder1.model.options, 'options exposed'
          for opt of options
              should.exist builder1.model[opt](), "#{opt} can be called"

        it 'renders', ->
            wrap = builder1.$ 'g.nvd3.nv-bulletChart'
            should.exist wrap[0]

        it 'displays multiple markers', ->
          markers = document.querySelectorAll '.nv-markerTriangle'
          markers.length.should.equal 2

        it 'has correct g.nvd3.nv-bulletChart position', ->
          chart = builder1.$ 'g.nvd3.nv-bulletChart'
          chart[0].getAttribute('transform').should.be.equal 'translate(90,60)'

        it "has correct structure", ->
          cssClasses = [
              '.nv-bulletWrap'
              '.nv-bullet'
              '.nv-rangeMax'
              '.nv-rangeAvg'
              '.nv-rangeMin'
              '.nv-measure'
              '.nv-markerTriangle'
              '.nv-titles'
              '.nv-title'
              '.nv-subtitle'
            ]
          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder1.$("g.nvd3 #{cssClass}")[0]

        describe "no markers", ->
          builder = null
          sampleData = null

          beforeEach ->
            builder = new ChartBuilder nv.models.bulletChart()
            noMarkerOptions =
              margin:
                top: 0
                right: 0
                bottom: 0
                left: 0
              width: 300
            sampleData =
              title: 'Revenue'
              subtitle: 'US$ in thousands'
              ranges: [10,20,30]
              measures: [40]
              markers: []
            builder.build noMarkerOptions, sampleData
          afterEach ->
            builder.teardown()

          it "does not show marker if no marker provided", ->
            markers = builder.$ '.nv-markerTriangle'
            markers.length.should.equal 0

          it "renders xAxis if empty markers", ->
            ticks = builder.$ '.nv-tick'
            ticks.length.should.equal 5

        describe "applies correctly option", ->

          builder = null
          sampleData = null

          beforeEach ->
            builder = new ChartBuilder nv.models.bulletChart()
            sampleData =
              title: 'Revenue'
              subtitle: 'US$ in thousands'
              ranges: [10,20,30]
              measures: [40]
              markers: [50]
          afterEach ->
            builder.teardown()

          describe "orient", ->

            it 'left', ->
              options =
                orient: 'left'
              builder.build options, sampleData
              ticks = builder.$(".nv-tick")
              offsetPrevious = 0
              offsetCurrent = 0
              pattern = ///
                  translate\((.*),0\)
              ///
              for tick, i in ticks
                offsetPrevious = offsetCurrent
                offsetCurrent = parseInt ticks[i].getAttribute('transform').match(pattern)[1]
                window.setTimeout ->
                    expect(offsetPrevious).to.be.below(offsetCurrent) if i > 0
                , 1500

            it 'right', ->
              options =
                orient: 'right'
              builder.build options, sampleData
              ticks = builder.$(".nv-tick")
              offsetPrevious = 0
              offsetCurrent = 0
              pattern = ///
                  translate\((.*),0\)
              ///
              for tick, i in ticks
                offsetPrevious = offsetCurrent
                offsetCurrent = parseInt ticks[i].getAttribute('transform').match(pattern)[1]
                window.setTimeout ->
                    expect(offsetPrevious).to.be.above(offsetCurrent) if i > 0
                , 1500

          it "noData", ->
            options =
              noData: 'No Data Available'
            builder.build options, {}
            builder.svg.textContent.should.be.equal 'No Data Available'


          it 'clears chart objects for no data', ->
            builder = new ChartBuilder nv.models.bulletChart()
            builder.buildover options, sampleData, []

            groups = builder.$ 'g'
            groups.length.should.equal 0, 'removes chart components'


          it 'margin', ->
            options =
              margin:
                top: 10
                right: 20
                bottom: 30
                left: 40
            builder.build options, sampleData
            builder.$(".nv-bulletChart")[0].getAttribute('transform').should.be.equal "translate(40,10)"

          it "color", ->
            options =
              color: -> "#000000"
            builder.build options, sampleData
            expect(builder.$(".nv-measure")[0].getAttribute("style")).to.contain "fill: rgb(0, 0, 0)"

          it 'width', ->
            options =
              margin:
                top: 0
                right: 0
                bottom: 0
                left: 0
              width: 300
            builder.build options, sampleData
            parseInt( builder.$(".nv-rangeMax")[0].getAttribute('width') ).should.be.equal 300

          it 'height', ->
            options =
              margin:
                top: 0
                right: 0
                bottom: 0
                left: 0
              height: 300
            builder.build options, sampleData
            parseInt( builder.$(".nv-rangeMax")[0].getAttribute('height') ).should.be.equal 300

