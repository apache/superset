describe 'NVD3', ->
    describe 'Distrochart', ->
        data = [
            {subject: 3, weight: 19, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 4, weight: 19.36, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 5, weight: 17.96, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 8, weight: 18.5, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 12, weight: 18.6, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 1, weight: 20.53, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 3, weight: 19.63, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 6, weight: 17.45, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 11, weight: 18.67, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 14, weight: 18.18, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 2, weight: 17.81, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 5, weight: 19.07, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 7, weight: 18.33, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 10, weight: 18.31, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 13, weight: 17.1, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 6, weight: 17.69, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 9, weight: 18.08, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 10, weight: 18.07, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 16, weight: 18.6, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 17, weight: 19.45, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 3, weight: 16.7, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 5, weight: 18.3, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 6, weight: 17.5, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 10, weight: 18.5, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 16, weight: 18.6, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 16.96, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 4, weight: 17.79, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 7, weight: 17.28, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 8, weight: 17.28, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 11, weight: 16.46, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 18.7, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 2, weight: 16.2, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 9, weight: 21.2, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 11, weight: 18.8, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 14, weight: 17.9, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 4, weight: 17.8, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 8, weight: 19.3, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 12, weight: 18.8, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 15, weight: 18.8, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 5, weight: 20.1, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 6, weight: 18.1, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 8, weight: 20.8, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 17, weight: 17.7, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 19, weight: 16.9, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 2, weight: 16.9, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 9, weight: 18.33, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 12, weight: 17.86, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 13, weight: 16.64, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 15, weight: 18.1, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 1, weight: 19, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 2, weight: 19.5, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 10, weight: 20.9, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 11, weight: 20, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 14, weight: 18.3, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 4, weight: 18.3, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 7, weight: 17, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 12, weight: 17.8, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 13, weight: 17.8, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 16, weight: 15.7, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 15, weight: 17.4, isolator: 'E', study: 'II', treatment: 'delta', donor: 'two'},
            {subject: 16, weight: 18.8, isolator: 'E', study: 'II', treatment: 'delta', donor: 'two'},
            {subject: 18, weight: 18, isolator: 'E', study: 'II', treatment: 'delta', donor: 'two'},
            {subject: 6, weight: 18.9, isolator: 'E', study: 'II', treatment: 'delta', donor: 'two'},
            {subject: 7, weight: 16.9, isolator: 'E', study: 'II', treatment: 'delta', donor: 'two'},
            {subject: 2, weight: 18.9, isolator: 'C', study: 'IV', treatment: 'delta', donor: 'two'},
            {subject: 3, weight: 18.7, isolator: 'C', study: 'IV', treatment: 'delta', donor: 'two'},
            {subject: 14, weight: 18.3, isolator: 'C', study: 'IV', treatment: 'delta', donor: 'two'},
            {subject: 16, weight: 18, isolator: 'C', study: 'IV', treatment: 'delta', donor: 'two'},
            {subject: 18, weight: 19.4, isolator: 'C', study: 'IV', treatment: 'delta', donor: 'two'},
            {subject: 3, weight: 18.4, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 4, weight: 18.6, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 5, weight: 18.3, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 8, weight: 18.3, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 12, weight: 18.6, isolator: 'C', study: 'V', treatment: 'delta', donor: 'two'},
            {subject: 14, weight: 19.9, isolator: 'D', study: 'II', treatment: 'delta', donor: 'nine'},
            {subject: 2, weight: 18.4, isolator: 'D', study: 'II', treatment: 'delta', donor: 'nine'},
            {subject: 3, weight: 17.4, isolator: 'D', study: 'II', treatment: 'delta', donor: 'nine'},
            {subject: 4, weight: 17.9, isolator: 'D', study: 'II', treatment: 'delta', donor: 'nine'},
            {subject: 8, weight: 17.6, isolator: 'D', study: 'II', treatment: 'delta', donor: 'nine'},
            {subject: 1, weight: 20.1, isolator: 'E', study: 'IV', treatment: 'gamma', donor: 'two'},
            {subject: 5, weight: 17.4, isolator: 'E', study: 'IV', treatment: 'gamma', donor: 'two'},
            {subject: 7, weight: 17.8, isolator: 'E', study: 'IV', treatment: 'gamma', donor: 'two'},
            {subject: 10, weight: 17.5, isolator: 'E', study: 'IV', treatment: 'gamma', donor: 'two'},
            {subject: 15, weight: 16.3, isolator: 'E', study: 'IV', treatment: 'gamma', donor: 'two'},
            {subject: 1, weight: 19.9, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 3, weight: 19.3, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 6, weight: 16.8, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 11, weight: 18.8, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 14, weight: 17.5, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 2, weight: 17, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 5, weight: 19.5, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 7, weight: 18.2, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 10, weight: 18.5, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 13, weight: 17.2, isolator: 'E', study: 'V', treatment: 'beta', donor: 'two'},
            {subject: 2, weight: 15.3, isolator: 'D', study: 'IV', treatment: 'alpha', donor: 'two'},
            {subject: 4, weight: 18.9, isolator: 'D', study: 'IV', treatment: 'alpha', donor: 'two'},
            {subject: 6, weight: 19.4, isolator: 'D', study: 'IV', treatment: 'alpha', donor: 'two'},
            {subject: 8, weight: 17.8, isolator: 'D', study: 'IV', treatment: 'alpha', donor: 'two'},
            {subject: 11, weight: 17.7, isolator: 'D', study: 'IV', treatment: 'alpha', donor: 'two'},
            {subject: 6, weight: 18, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 9, weight: 18.7, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 10, weight: 18.1, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 16, weight: 18.9, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 17, weight: 19.4, isolator: 'D', study: 'V', treatment: 'alpha', donor: 'two'},
            {subject: 10, weight: 18.9, isolator: 'D', study: 'III', treatment: 'control', donor: 'one'},
            {subject: 13, weight: 17.5, isolator: 'D', study: 'III', treatment: 'control', donor: 'one'},
            {subject: 16, weight: 17.9, isolator: 'D', study: 'III', treatment: 'control', donor: 'one'},
            {subject: 4, weight: 18.7, isolator: 'D', study: 'III', treatment: 'control', donor: 'one'},
            {subject: 6, weight: 17.5, isolator: 'D', study: 'III', treatment: 'control', donor: 'one'},
            {subject: 3, weight: 16.5, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 5, weight: 18, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 6, weight: 17.1, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 10, weight: 17.6, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 16, weight: 18, isolator: 'F', study: 'I', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 17.7, isolator: 'C', study: 'II', treatment: 'control', donor: 'two'},
            {subject: 13, weight: 19.1, isolator: 'C', study: 'II', treatment: 'control', donor: 'two'},
            {subject: 15, weight: 17.7, isolator: 'C', study: 'II', treatment: 'control', donor: 'two'},
            {subject: 17, weight: 17.5, isolator: 'C', study: 'II', treatment: 'control', donor: 'two'},
            {subject: 6, weight: 18.1, isolator: 'C', study: 'II', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 19.3, isolator: 'B', study: 'IV', treatment: 'control', donor: 'two'},
            {subject: 3, weight: 17.6, isolator: 'B', study: 'IV', treatment: 'control', donor: 'two'},
            {subject: 6, weight: 17.4, isolator: 'B', study: 'IV', treatment: 'control', donor: 'two'},
            {subject: 7, weight: 17.5, isolator: 'B', study: 'IV', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 16.7, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 4, weight: 18.2, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 7, weight: 16.8, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 8, weight: 16.9, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 11, weight: 16, isolator: 'A', study: 'V', treatment: 'control', donor: 'two'},
            {subject: 1, weight: 18.8, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 2, weight: 15.8, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 9, weight: 21, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 11, weight: 18.5, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 14, weight: 17.3, isolator: 'E', study: 'I', treatment: 'control', donor: 'three'},
            {subject: 4, weight: 18, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 8, weight: 19.4, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 12, weight: 18.8, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 15, weight: 18.8, isolator: 'D', study: 'I', treatment: 'control', donor: 'four'},
            {subject: 1, weight: 18.3, isolator: 'C', study: 'III', treatment: 'control', donor: 'five'},
            {subject: 17, weight: 19.8, isolator: 'C', study: 'III', treatment: 'control', donor: 'five'},
            {subject: 18, weight: 18.5, isolator: 'C', study: 'III', treatment: 'control', donor: 'five'},
            {subject: 2, weight: 18.2, isolator: 'C', study: 'III', treatment: 'control', donor: 'five'},
            {subject: 8, weight: 17.4, isolator: 'C', study: 'III', treatment: 'control', donor: 'five'},
            {subject: 5, weight: 20, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 6, weight: 17.2, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 8, weight: 20.7, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 17, weight: 17.8, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 19, weight: 17.5, isolator: 'C', study: 'I', treatment: 'control', donor: 'six'},
            {subject: 10, weight: 19.3, isolator: 'B', study: 'III', treatment: 'control', donor: 'seven'},
            {subject: 11, weight: 18.7, isolator: 'B', study: 'III', treatment: 'control', donor: 'seven'},
            {subject: 4, weight: 18.9, isolator: 'B', study: 'III', treatment: 'control', donor: 'seven'},
            {subject: 6, weight: 20.8, isolator: 'B', study: 'III', treatment: 'control', donor: 'seven'},
            {subject: 7, weight: 19, isolator: 'B', study: 'III', treatment: 'control', donor: 'seven'},
            {subject: 2, weight: 16.5, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 9, weight: 18.4, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 12, weight: 18.8, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 13, weight: 17.1, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 15, weight: 18.4, isolator: 'B', study: 'V', treatment: 'control', donor: 'seven'},
            {subject: 1, weight: 18.5, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 2, weight: 18.9, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 10, weight: 20.1, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 11, weight: 19.3, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 14, weight: 18.6, isolator: 'B', study: 'I', treatment: 'control', donor: 'eight'},
            {subject: 11, weight: 19.4, isolator: 'A', study: 'II', treatment: 'control', donor: 'eight'},
            {subject: 14, weight: 19.3, isolator: 'A', study: 'II', treatment: 'control', donor: 'eight'},
            {subject: 2, weight: 17.9, isolator: 'A', study: 'II', treatment: 'control', donor: 'eight'},
            {subject: 3, weight: 18.1, isolator: 'A', study: 'II', treatment: 'control', donor: 'eight'},
            {subject: 4, weight: 17.4, isolator: 'A', study: 'II', treatment: 'control', donor: 'eight'},
            {subject: 4, weight: 17.8, isolator: 'A', study: 'IV', treatment: 'control', donor: 'eight'},
            {subject: 9, weight: 17.2, isolator: 'A', study: 'IV', treatment: 'control', donor: 'eight'},
            {subject: 12, weight: 16.4, isolator: 'A', study: 'IV', treatment: 'control', donor: 'eight'},
            {subject: 13, weight: 17.9, isolator: 'A', study: 'IV', treatment: 'control', donor: 'eight'},
            {subject: 17, weight: 19.9, isolator: 'A', study: 'IV', treatment: 'control', donor: 'eight'},
            {subject: 12, weight: 18, isolator: 'A', study: 'III', treatment: 'control', donor: 'eight'},
            {subject: 15, weight: 18.7, isolator: 'A', study: 'III', treatment: 'control', donor: 'eight'},
            {subject: 2, weight: 19.6, isolator: 'A', study: 'III', treatment: 'control', donor: 'eight'},
            {subject: 3, weight: 17.8, isolator: 'A', study: 'III', treatment: 'control', donor: 'eight'},
            {subject: 9, weight: 18.3, isolator: 'A', study: 'III', treatment: 'control', donor: 'eight'},
            {subject: 4, weight: 18.2, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 7, weight: 16.9, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 12, weight: 18.2, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 13, weight: 17.6, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 16, weight: 15.5, isolator: 'A', study: 'I', treatment: 'control', donor: 'nine'},
            {subject: 1, weight: 17, isolator: 'B', study: 'II', treatment: 'control', donor: 'nine'},
            {subject: 16, weight: 18.1, isolator: 'B', study: 'II', treatment: 'control', donor: 'nine'},
            {subject: 17, weight: 18.3, isolator: 'B', study: 'II', treatment: 'control', donor: 'nine'},
            {subject: 18, weight: 19.5, isolator: 'B', study: 'II', treatment: 'control', donor: 'nine'},
            {subject: 5, weight: 18.3, isolator: 'B', study: 'II', treatment: 'control', donor: 'nine'},
        ]

        options =
            x: (d)-> d.study
            y: (d)-> d.weight
            colorGroup: (d)-> d.donor
            maxBoxWidth: false
            plotType: 'box'
            observationType: 'random'
            whiskerDef: 'iqr'
            notchBox: false
            hideWhiskers: false
            centralTendency: 'mean'
            bandwidth: 'scott'
            clampViolin: true
            resolution: 50
            showOnlyOutliers: true
            jitter: 0.7
            squash: false
            pointSize: 4
            margin:
                top: 30
                right: 60
                bottom: 80
                left: 10

        builder = null
        beforeEach ->
            builder = new ChartBuilder nv.models.distroPlotChart()
            builder.build options, data

        afterEach ->
            builder.teardown()

        it 'api check', ->
            should.exist builder.model.options, 'options exposed'
            for opt of options
                should.exist builder.model[opt](), "#{opt} can be called"

            builder.model.update()

        it 'renders', ->
            wrap = builder.$ 'g.nvd3.nv-distroPlot'
            should.exist wrap[0]

        it 'no data text', ->
            builder = new ChartBuilder nv.models.distroPlotChart()
            builder.build options, []

            noData = builder.$ '.nv-noData'
            noData[0].textContent.should.equal 'No Data Available.'

        it 'has correct structure', ->
          cssClasses = [
            '.nv-x.nv-axis'
            '.nv-y.nv-axis'
            '.nv-wrap'
            '.nv-distroWrap'
            '.nv-distroplot-x-group'
            '.nv-distroplot-whisker'
            '.nv-distroplot-low'
            '.nv-distroplot-tick'
            '.nv-distroplot-high'
            '.nv-distribution-area'
            '.nv-distribution-left'
            '.nv-distribution-right'
            '.nv-distribution-line'
            '.nv-distroplot-observation'
            '.nv-distroplot-outlier'
            '.nv-distroplot-non-outlier'
          ]
          for cssClass in cssClasses
            do (cssClass) ->
              should.exist builder.$("g.nvd3.nv-distroPlot #{cssClass}")[0]

        it 'has all x groups', ->
            groups = builder.$ '.nv-distroplot-x-group'
            groups.should.have.length 17, 'groups exist'

        it 'has all outliers', ->
            groups = builder.$ '.nv-distroplot-outlier'
            groups.should.have.length 11, 'outliers exist'
