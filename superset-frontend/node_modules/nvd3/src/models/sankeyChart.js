nv.models.sankeyChart = function() {
    "use strict";

    // Sources:
    // - https://bost.ocks.org/mike/sankey/
    // - https://github.com/soxofaan/d3-plugin-captain-sankey

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 5, right: 0, bottom: 5, left: 0}
        , sankey = nv.models.sankey()
        , width = 600
        , height = 400
        , nodeWidth = 36
        , nodePadding =  40
        , units = 'units'
        , center = undefined
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var formatNumber = d3.format(',.0f');    // zero decimal places
    var format = function(d) {
        return formatNumber(d) + ' ' + units;
    };
    var color = d3.scale.category20();
    var linkTitle = function(d){
        return d.source.name + ' → ' + d.target.name + '\n' + format(d.value);
    };
    var nodeFillColor = function(d){
        return d.color = color(d.name.replace(/ .*/, ''));
    };
    var nodeStrokeColor = function(d){
        return d3.rgb(d.color).darker(2);
    };
    var nodeTitle = function(d){
        return d.name + '\n' + format(d.value);
    };

    var showError = function(element, message) {
        element.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('class', 'nvd3-sankey-chart-error')
            .attr('text-anchor', 'middle')
            .text(message);
    };

    function chart(selection) {
        selection.each(function(data) {

            var testData = {
                nodes:
                    [
                        {'node': 1, 'name': 'Test 1'},
                        {'node': 2, 'name': 'Test 2'},
                        {'node': 3, 'name': 'Test 3'},
                        {'node': 4, 'name': 'Test 4'},
                        {'node': 5, 'name': 'Test 5'},
                        {'node': 6, 'name': 'Test 6'}
                    ],
                links:
                    [
                        {'source': 0, 'target': 1, 'value': 2295},
                        {'source': 0, 'target': 5, 'value': 1199},
                        {'source': 1, 'target': 2, 'value': 1119},
                        {'source': 1, 'target': 5, 'value': 1176},
                        {'source': 2, 'target': 3, 'value': 487},
                        {'source': 2, 'target': 5, 'value': 632},
                        {'source': 3, 'target': 4, 'value': 301},
                        {'source': 3, 'target': 5, 'value': 186}
                    ]
            };

            // Error handling
            var isDataValid = false;
            var dataAvailable = false;

            // check if data is valid
            if(
                (typeof data['nodes'] === 'object' && data['nodes'].length) >= 0 &&
                (typeof data['links'] === 'object' && data['links'].length) >= 0
            ){
                isDataValid = true;
            }

            // check if data is available
            if(
                data['nodes'] && data['nodes'].length > 0 &&
                data['links'] && data['links'].length > 0
            ) {
                dataAvailable = true;
            }

            // show error
            if(!isDataValid) {
                console.error('NVD3 Sankey chart error:', 'invalid data format for', data);
                console.info('Valid data format is: ', testData, JSON.stringify(testData));
                showError(selection, 'Error loading chart, data is invalid');
                return false;
            }

            // TODO use nv.utils.noData
            if(!dataAvailable) {
                showError(selection, 'No data available');
                return false;
            }

            // No errors, continue

            // append the svg canvas to the page
            var svg = selection.append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('class', 'nvd3 nv-wrap nv-sankeyChart');

            // Set the sankey diagram properties
            sankey
                .nodeWidth(nodeWidth)
                .nodePadding(nodePadding)
                .size([width, height]);

            var path = sankey.link();

            sankey
                .nodes(data.nodes)
                .links(data.links)
                .layout(32)
                .center(center);

            // add in the links
            var link = svg.append('g').selectAll('.link')
                .data(data.links)
                .enter().append('path')
                .attr('class', 'link')
                .attr('d', path)
                .style('stroke-width', function(d) { return Math.max(1, d.dy); })
            .sort(function(a,b) { return b.dy - a.dy; });

            // add the link titles
            link.append('title')
                .text(linkTitle);

            // add in the nodes
            var node = svg.append('g').selectAll('.node')
                .data(data.nodes)
                .enter().append('g')
                .attr('class', 'node')
                .attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; })
                .call(
                    d3.behavior
                        .drag()
                        .origin(function(d) { return d; })
                        .on('dragstart', function() {
                            this.parentNode.appendChild(this);
                        })
                        .on('drag', dragmove)
                );

            // add the rectangles for the nodes
            node.append('rect')
                .attr('height', function(d) { return d.dy; })
                .attr('width', sankey.nodeWidth())
                .style('fill', nodeFillColor)
                .style('stroke', nodeStrokeColor)
                .append('title')
                .text(nodeTitle);

            // add in the title for the nodes
            node.append('text')
                .attr('x', -6)
                .attr('y', function(d) { return d.dy / 2; })
                .attr('dy', '.35em')
                .attr('text-anchor', 'end')
                .attr('transform', null)
                .text(function(d) { return d.name; })
                .filter(function(d) { return d.x < width / 2; })
                .attr('x', 6 + sankey.nodeWidth())
                .attr('text-anchor', 'start');

            // the function for moving the nodes
            function dragmove(d) {
                d3.select(this).attr('transform',
                'translate(' + d.x + ',' + (
                    d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
                ) + ')');
                sankey.relayout();
                link.attr('d', path);
            }
        });

        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        units:           {get: function(){return units;},       set: function(_){units=_;}},
        width:           {get: function(){return width;},       set: function(_){width=_;}},
        height:          {get: function(){return height;},      set: function(_){height=_;}},
        format:          {get: function(){return format;},      set: function(_){format=_;}},
        linkTitle:       {get: function(){return linkTitle;},   set: function(_){linkTitle=_;}},
        nodeWidth:       {get: function(){return nodeWidth;},   set: function(_){nodeWidth=_;}},
        nodePadding:     {get: function(){return nodePadding;}, set: function(_){nodePadding=_;}},
        center:          {get: function(){return center},       set: function(_){center=_}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        nodeStyle: {get: function(){return {};}, set: function(_){
            nodeFillColor   = _.fillColor   !== undefined ? _.fillColor   : nodeFillColor;
            nodeStrokeColor = _.strokeColor !== undefined ? _.strokeColor : nodeStrokeColor;
            nodeTitle       = _.title       !== undefined ? _.title       : nodeTitle;
        }}

    });

    nv.utils.initOptions(chart);

    return chart;
};
