###
Utility to build an NVD3 chart.
###
class ChartBuilder
    # @model should be something like nv.models.scatterChart()
    constructor: (@model)->

    ###
    options: an object hash of chart options.
    data: sample data to pass in to chart.

    This method builds a chart and puts it on the <body> element.
    ###
    build: (options, data)->
        @svg = document.createElement 'svg'
        document.querySelector('body').appendChild @svg

        for opt, val of options
            unless @model[opt]?
                console.warn "#{opt} not property of model."
            else
                @model[opt](val)

        @updateData data

    ###
    Update the data while preserving the chart model.
    ###
    updateData: (data)->
        d3.select(@svg).datum(data).call(@model)

    ###
    options: an object hash of chart options.
    data: sample data to pass in to initial chart render chart
    data2: sample data to pass to second chart render

    This method builds a chart, puts it on the <body> element, and then rebuilds using the second set of data
    Useful for testing the results of transitioning and the 'noData' state after a chart has had data
    ###
    buildover: (options, data, data2)->
        @svg = document.createElement 'svg'
        document.querySelector('body').appendChild @svg

        for opt, val of options
            unless @model[opt]?
                console.warn "#{opt} not property of model."
            else
                @model[opt](val)

        #Set initial data
        chart = d3.select(@svg)
        chart.datum(data)
            .call(@model)

        #Reset the data
        chart.datum(data2)
            .call(@model)



    # Removes chart from <body> element.
    teardown: ->
        if @svg?
            document.querySelector('body').removeChild @svg

    # Runs a simple CSS selector to retrieve elements
    $: (cssSelector)->
        @svg.querySelectorAll cssSelector
