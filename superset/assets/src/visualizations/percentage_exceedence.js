import d3 from 'd3';
import '../../stylesheets/d3tip.css';
import './percentage_exceedence.css';

function percentageExceedenceVis(slice, payload) {
    const div = d3.select(slice.selector);
    // Define the percentage bounds that define color from red to green
    div.html(''); // reset
    const json = payload.data;
    const width1 = slice.width();
    const height1 = slice.height();
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = width1 - margin.left - margin.right;
    const height = height1 - margin.top - margin.bottom;
    const svg = div.append('svg')
        .attr('width', width1)
        .attr('height', height1);
    const jsonData = json.data;

    // set the ranges
    const x = d3.scale.linear()
        .rangeRound([0, width]);
    const y = d3.scale.linear()
        .rangeRound([height, 0]);
    const xAxis = d3.svg.axis().scale(x).orient('bottom');
    const yAxis = d3.svg.axis().scale(y).orient('left');

    const line = d3.svg.line()
        .x(function (d) {
            return x(d.percentExceedence);
        })
        .y(function (d) {
            return y(d.close);
        });

    // append the svg object to the body of the page
    // append a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    const g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    Object.keys(jsonData).forEach((key) => {
        const data = jsonData[key];
        const exceedenceParam = 100 / data.length;
        data.forEach((d, index) => {
            d.percentExceedence = exceedenceParam * index;
            d.close = +d.close;
        });

        // Scale the range of the data in the domains
        x.domain(d3.extent(data, function (d) {
            return d.percentExceedence;
        }));
        y.domain(d3.extent(data, function (d) {
            return d.close;
        }));
        g.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.5)
            .attr('d', line);
        g.append('g')
            .attr('transform', 'translate(0,' + height + ')')
            .call(xAxis);
        g.append('g')
            .call(yAxis);
        });
}

module.exports = percentageExceedenceVis;
