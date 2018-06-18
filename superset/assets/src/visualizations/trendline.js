import d3 from 'd3';
import { d3TimeFormatPreset, d3FormatPreset } from '../modules/utils';
import { getColorFromScheme } from '../modules/colors';

require('./trendline.css');

function trendline(slice, payload) {
    const fd = slice.formData;
    const margin = {
        top: 20,
        right: 40,
        bottom: (fd.x_axis_label) ? 40 : 20,
        left: (fd.y_axis_label) ? 60 : 40,
    };

    margin.bottom = (fd.bottom_margin !== 'auto') ? parseInt(fd.bottom_margin, 10) : margin.bottom;
    margin.left = (fd.left_margin !== 'auto') ? parseInt(fd.left_margin, 10) : margin.left;
    const width = slice.width() - (margin.left + margin.right);
    const height = slice.height() - (margin.top + margin.bottom);
    const divChart = d3.select(slice.selector);
    const decimalFormat = d3.format('0.2f');
    const data = payload.data.data;
    const xDataLabel = '__timestamp';
    const yDataLabel = fd.metric.label;

    divChart.selectAll('*').remove();

    const svg = divChart.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

    const ground = svg.append('g').attr('transform', 'translate(' + margin.left + ',0)');
    const xAxisFormatter = d3TimeFormatPreset((fd.x_axis_format === 'smart_date') ? '%d-%b-%Y' : fd.x_axis_format);
    let yAxisFormatter = '';

    const xScale = d3.time.scale()
    .range([0, width]);

    const yScale = d3.scale.linear()
    .range([height, 0]);

    xScale.domain(d3.extent(data, function (d) { return d[xDataLabel]; }));
    yScale.domain([0, Math.round(d3.max(data, function (d) {
        return parseFloat(d[yDataLabel]);
    }))]);

    const xLabels = data.map(function (d) { return d[xDataLabel]; });
    const lineColor = getColorFromScheme(1, fd.color_scheme);
    function drawLineChart() {
        svg.append('g')
        .attr('class', 'y axis');

        svg.append('g')
        .attr('class', 'x axis');

        const xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .tickFormat(xAxisFormatter);

        const yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left');

        const line = d3.svg.line()
        .x(function (d) { return xScale(d[xDataLabel]); })
        .y(function (d) { return yScale(d[yDataLabel]); })
        .interpolate(fd.line_interpolation);

        ground.append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line)
        .attr('stroke', lineColor);

        if (fd.show_markers) {
            ground.selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d[xDataLabel]))
            .attr('cy', d => yScale(d[yDataLabel]))
            .attr('r', 2)
            .attr('fill', lineColor);
        }

        svg.select('.x.axis')
        .attr('transform', 'translate(' + margin.left + ', ' + height + ')')
        .call(xAxis);

        if (fd.y_axis_format) {
            yAxisFormatter = d3FormatPreset(fd.y_axis_format);
            yAxis.tickFormat(yAxisFormatter);
        }
        svg.select('.y.axis')
        .attr('transform', 'translate(' + (margin.left) + ',0)')
        .call(yAxis);

        // x axis label
        if (fd.x_axis_label) {
            svg.append('text')
            .attr('x', (width + (margin.left + margin.right)) / 2)
            .attr('y', height + margin.bottom)
            .attr('class', 'text-label')
            .attr('text-anchor', 'middle')
            .text(fd.x_axis_label);
        }

        if (fd.y_axis_label) {
            svg.append('text')
            .attr('x', ((height + margin.bottom + margin.top) / 2) * -1)
            .attr('y', margin.left / 4)
            .attr('class', 'text-label')
            .attr('text-anchor', 'start')
            .attr('transform', 'rotate(-90)')
            .text(fd.y_axis_label);
        }
    }

    const bisectDate = d3.bisector(function (d) { return d[xDataLabel]; }).left;

    // returns slope, intercept and r-square of the line
    function leastSquares(xSeries, ySeries) {
        const reduceSumFunc = function (prev, cur) { return prev + cur; };
        const xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
        const yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

        const ssXX = xSeries.map(function (d) { return Math.pow(d - xBar, 2); })
        .reduce(reduceSumFunc);

        const ssYY = ySeries.map(function (d) { return Math.pow(d - yBar, 2); })
        .reduce(reduceSumFunc);

        const ssXY = xSeries.map(function (d, i) { return (d - xBar) * (ySeries[i] - yBar); })
        .reduce(reduceSumFunc);

        const slope = ssXY / ssXX;
        const intercept = yBar - (xBar * slope);
        const rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

        return [slope, intercept, rSquare];
    }

    function drawTrendLine() {
        // get the x and y values for least squares
        const xSeries = d3.range(1, xLabels.length + 1);
        const ySeries = data.map(function (d) { return parseFloat(d[yDataLabel]); });

        const leastSquaresCoeff = leastSquares(xSeries, ySeries);

        // apply the reults of the least squares regression
        const x1 = xLabels[0];
        const y1 = leastSquaresCoeff[0] + leastSquaresCoeff[1];
        const x2 = xLabels[xLabels.length - 1];
        const y2 = leastSquaresCoeff[0] * xSeries.length + leastSquaresCoeff[1];
        const trendData = [[x1, y1, x2, y2]];

        const trendlineSvg = ground.selectAll('.trendline')
        .data(trendData);

        trendlineSvg.enter()
        .append('line')
        .attr('class', 'trendline')
        .attr('x1', function (d) { return xScale(d[0]); })
        .attr('y1', function (d) { return yScale(d[1]); })
        .attr('x2', function (d) { return xScale(d[2]); })
        .attr('y2', function (d) { return yScale(d[3]); })
        .attr('stroke', 'rgba(' + fd.color_picker.r + ', ' + fd.color_picker.g + ', ' + fd.color_picker.b + ', ' + fd.color_picker.a + ')')
        .attr('stroke-width', 2);

        // display equation on the chart
        svg.append('text')
        .text('eq: ' + decimalFormat(leastSquaresCoeff[0]) + 'x + ' +
        decimalFormat(leastSquaresCoeff[1]))
        .attr('class', 'text-label')
        .attr('x', function () { return xScale(x2) - 60; })
        .attr('y', function () { return yScale(y2) - 30; });

        // display r-square on the chart
        svg.append('text')
        .text('r-sq: ' + decimalFormat(leastSquaresCoeff[2]))
        .attr('class', 'text-label')
        .attr('x', function () { return xScale(x2) - 60; })
        .attr('y', function () { return yScale(y2) - 10; });
    }

    function drawToolTip() {
        const fowidth = 150;

        const focus = ground.append('g')
        .style('display', 'none');
        
        const hoverLine = focus.append('line')
        .attr('stroke', '#ccc')
        .attr('x1', 10)
        .attr('x2', 10)
        .attr('y1', 0)
        .attr('y2', height);

        function drawForeignObject(x, d) {
            const fo = ground.append('foreignObject');
            fo.attr({
                id: 'tooltip',
                x: ((width + margin.left + margin.right) - xScale(d[xDataLabel])) < fowidth ?
                ((xScale(d[xDataLabel]) + margin.left + margin.right)
                - fowidth) : xScale(d[xDataLabel]),
                y: yScale(d[yDataLabel]),
                width: fowidth,
                class: 'svg-tooltip',
            });
            const div = fo.append('xhtml:div')
            .append('div')
            .attr({ class: 'tooltip' });

            div.append('p')
            .html(xAxisFormatter(new Date(d[xDataLabel])));

            div.append('p')
            .html('<span style="height:10px;width:10px;display:inline-block;background:' +
            lineColor + '"></span>&nbsp;&nbsp;' + yDataLabel + '&nbsp;<strong>' +
            (fd.y_axis_format ? yAxisFormatter(d[y_data_label]) : d[y_data_label]) + '</strong>');
            const foHeight = div[0][0].getBoundingClientRect().height;
            fo.attr({ height: foHeight });
        }
        
        function mousemove() {
            const mouseX = d3.mouse(this)[0];
            const x0 = xScale.invert(mouseX);
            const i = bisectDate(data, x0, 1);
            const d0 = data[i - 1];
            const d1 = data[i];

            if (d0[xDataLabel] && d1[xDataLabel]) {
                const d = x0 - d0[xDataLabel] > d1[xDataLabel] - x0 ? d1 : d0;
                hoverLine.attr('x1', mouseX).attr('x2', mouseX);
                d3.select('#tooltip').remove('');
                drawForeignObject(mouseX, d);
            }
        }
        
        ground.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mouseover', function () { focus.style('display', null); })
        .on('mouseout', function () {
            focus.style('display', 'none');
            d3.select('#tooltip').remove('');
        })
        .on('mousemove', mousemove);
    }

    drawLineChart();
    drawTrendLine();
    drawToolTip();
}

module.exports = trendline;
