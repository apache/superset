import d3 from 'd3';
import './doughnut.css';

function doughnut(slice, json) {
    slice.container.html('');
    var data = json.data
    const div = d3.select(slice.selector);
    const width = slice.width();
    const height = slice.height();

    const radius = Math.min(width, height) / 2;

    var color = d3.scale.category20();

    var pie = d3.layout.pie()
        .value(function (d) { return d.y; })
        .sort(null);

    var arc = d3.svg.arc()
        .innerRadius(radius - 100)
        .outerRadius(radius - 20);

    const svg = div.append('svg')
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var g = svg.selectAll(".arc")
        .data(pie(data))
        .enter().append("g")
        .attr("class", "arc");

    g.append("path")
        .attr("d", arc)
        .style("fill", function (d) { return color(d.data.y); });

    g.append("text")
        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .text(function (d) { return d.data.x; });
};

module.exports = doughnut;