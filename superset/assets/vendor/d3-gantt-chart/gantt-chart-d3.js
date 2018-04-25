/**
 * @author Dimitry Kudrayvtsev
 * from: https://github.com/dk8996/Gantt-Chart (original)
 * from: https://github.com/nseba/Gantt-Chart  (modified fork)
 *
 * modified for superset
 */

export const d3gantt = () => {

    var FIT_TIME_DOMAIN_MODE = "fit";
    var FIXED_TIME_DOMAIN_MODE = "fixed";

    var margin = {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
    };
    var selector = 'body';
    var xAxisSelector = '.wf-gantt-chart-x-axis';
    var chartSelector = '.wf-gantt-chart';
    var timeDomainStart = d3.time.day.offset(new Date(), -3);
    var timeDomainEnd = d3.time.hour.offset(new Date(), +3);
    var timeDomainMode = FIT_TIME_DOMAIN_MODE; // fixed or fit
    var taskTypes = [];
    var taskStatus = [];
    var height = document.body.clientHeight - margin.top - margin.bottom - 5;
    var width = document.body.clientWidth - margin.right - margin.left - 5;
    var tickFormat = "%H:%M";
    var ticks = 4;
    var barPaddingBottom = 5;
    var minBarHeight = 60;
    var maxBarHeight = 120;
    var onClickBar = null;

    var tooltipFormatStartDate = function (task) { return task.startDate; };
    var tooltipFormatEndDate = function (task) { return task.endDate; };
    var tooltipValueFormat = function (task) { return task.startDate - task.endDate };

    var keyFunction = function (d) { return d.startDate + d.taskName + d.endDate; };
    var rectTransform = function (d) {
        return "translate(" + x(d.startDate) + "," + y(d.taskName) + ")";
    };

    var getHeight = function (count) {
        if (count < 5) {
            //console.warn(maxBarHeight);
            return count * maxBarHeight;
        }
        var newHeight = count * minBarHeight;
        //console.log(this.minBarHeight);
        return newHeight;
    }

    var x = d3.time
            .scale()
            .range([0, width - margin.left - margin.right]),
        y_1 = d3.scale.linear()
            .domain(Object.keys(taskTypes))
            .range([0, getHeight(taskTypes.length) - margin.top - margin.bottom]),
        y = d3.scale.ordinal()
            .domain(taskTypes)
            .rangeRoundBands([0, getHeight(taskTypes.length) - margin.top - margin.bottom], .5);


    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickFormat(d3.time.format(tickFormat))
        .tickSize(-getHeight(taskTypes.length))
        .ticks(ticks);

    var xAxis_2 = d3.svg.axis()
        .scale(x)
        .orient("top")
        .tickFormat(d3.time.format(tickFormat))
        .tickSize(-getHeight(taskTypes.length))
        .ticks(ticks);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        //.tickSize(0)
        .ticks(5)
        .tickPadding(12);

    var initTimeDomain = function (tasks) {
        if (timeDomainMode === FIT_TIME_DOMAIN_MODE) {
            if (tasks === undefined || tasks.length < 1) {
                timeDomainStart = d3.time.day.offset(new Date(), -3);
                timeDomainEnd = d3.time.hour.offset(new Date(), +3);
                return;
            }
            tasks.sort(function (a, b) { return b.endDate - a.endDate; });
            timeDomainEnd = tasks[0].endDate;

            tasks.sort(function (a, b) { return a.startDate - b.startDate; });
            timeDomainStart = tasks[0].startDate;
        }
    };

    function gantt(tasks) {

        //      Render Tooltip
        var format = d3.time.format("%H:%M:%S %d.%m");
        var tooltip = d3.select(selector)
            .append("div")
            .attr("class", "c3-tooltip-container")
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("display", "none");
        var body = tooltip
            .append("table")
            .attr("class", "c3-tooltip")
            .append("tbody");
        var tooltipTitle = body.append("tr")
            .append("th")
            .attr("colspan", "3");
        var tr = body.append("tr")
            .attr("class", "c3-tooltip-name-heatmap");
        var startTd = tr.append("td")
            .attr("class", "name");
        startTd.append("span")
            .style("background-color", "#003c65");
        var endTd = tr.append("td")
            .attr("class", "name");
        endTd.append("span")
            .style("background-color", "#003c65");
        var tooltipValue = tr.append("td")
            .attr("class", "value");


        initTimeDomain(tasks);


        x = d3.time.scale()
            .range([0, width - margin.left - margin.right])
            .domain([timeDomainStart, timeDomainEnd]);
        y_1 = d3.scale.linear()
            .domain(Object.keys(taskTypes))
            .range([0, getHeight(taskTypes.length) - margin.top - margin.bottom]);
        y = d3.scale.ordinal()
            .domain(taskTypes)
            .rangeRoundBands([0, getHeight(taskTypes.length) - margin.top - margin.bottom], .5);

        xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom")
                .tickFormat(d3.time.format(tickFormat))
                //.tickSubdivide(true)
                .tickSize(-getHeight(taskTypes.length))
                .ticks(ticks),

        xAxis_2 = d3.svg.axis()
                .scale(x)
                .orient("top")
                .tickFormat(d3.time.format(tickFormat))
                //.tickSubdivide(true)
                .tickSize(-getHeight(taskTypes.length))
                .ticks(ticks),


            yAxis = d3.svg.axis()
                .scale(y)
                .orient("left")
                //.tickSize(2)
                .ticks(5)
                .tickPadding(12);

        var chart = d3.select(selector)
            .append("svg")
            .attr("class", "chart")
            .attr("width", width)
            .attr("height", getHeight(taskTypes.length) + margin.top + margin.bottom);

        var svg = chart.append("g")
            .attr("class", "gantt-chart")
            .attr("width", width)
            .attr("height", getHeight(taskTypes.length) + margin.top + margin.bottom)
            .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

        svg.append("g")
            .attr("class", "wf-gantt-x-axis x axis")
            .attr("transform", "translate(0, " + (getHeight(taskTypes.length) - margin.top - margin.bottom) + ")")
            .call(xAxis);

        svg.select(".y")
            .call(yAxis)
            .selectAll("text")
            .style("text-anchor", "start")
            .attr("transform", "translate(25, -" + y.rangeBand() + ")");


        var xAxisSvg = d3.select(xAxisSelector)
            .append('svg')
            .attr("width", width + margin.left + margin.right)
            .attr("height", 20)
            .append("g");


        var xAxisDom = xAxisSvg.selectAll('.x.axis');
        if (xAxisDom.empty()) {
            xAxisDom = xAxisSvg.append("g")
                .attr("class", "wf-gantt-x-axis x axis");
        }
        xAxisDom
          .attr("transform", "translate(" + (margin.left) + "," + 15 + ")")
          .call(xAxis_2);


        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .selectAll("text")
            .style("text-anchor", "start")
            .attr("transform", "translate(25, -" + y.rangeBand() + ")");


        svg.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width - margin.left - margin.right)
            .attr("height", getHeight(taskTypes.length));

        svg.append("g")
            .attr("class", "gantt-chart-container")
            .attr("clip-path", "url(#clip)");


        //var drw = chart.append("rect")
        //    .attr("class", "pane")
        //    .attr("width", width - margin.left - margin.right)
        //    .attr("height", getHeight(taskTypes.length))
        //    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");


        var ganttChartGroup = svg.select(".gantt-chart-container");

        ganttChartGroup.selectAll("rect")
            .data(tasks, keyFunction)
            .enter()
            .append("rect")
            .attr("class",
                function (d) {
                    var statusClass = taskStatus[d.status] || "bar";
                    var clickable = onClickBar ? "clickable" : "";
                    return statusClass + clickable;
                })
            .style("fill", function (d) { return d.color; })
            // .attr("y", 0)
            .attr("transform", rectTransform)
            .attr("height", function (d) { return y.rangeBand() - barPaddingBottom; })
            .attr("width", function (d) { return (x(d.endDate) - x(d.startDate)); })
            //.attr("clip-path", "url(#clip)");
            .on("mouseout",
                function () {
                    tooltip.style("display", "none");
                    d3.select(this)
                        .transition()
                        .duration(100)
                        .attr("stroke-width", 0);
                })
            .on("mousemove",
                function (x) {
                    tooltipTitle
                        .html(x.name ? x.name : x.taskName);
                    startTd.html(tooltipFormatStartDate(x));
                    endTd.html(tooltipFormatEndDate(x));
                    tooltipValue.html(tooltipValueFormat(x));
                    tooltip
                        .style("top", (event.offsetY + 20) + "px")
                        .style("left", (event.offsetX + 20) + "px")
                        .style("display", "block")
                        .transition()
                        .duration(100)
                        .attr("stroke-width", 2);
                })
            .on("click",
                function (data) {
                    if (onClickBar) {
                        onClickBar(data);
                    }
                });

        var zoom = d3.behavior.zoom()
            .x(x)
            .y(y_1)
            .scaleExtent([0.5, 30])
            .scale(1)
            .on("zoom", zoomed);

        chart.select(".gantt-chart").call(zoom);
        xAxisDom.call(zoom);

        function zoomed() {
            //console.log("zoomed");
            gantt.redraw(tasks);
        }

        return gantt;
    };

    gantt.redraw = function (tasks) {
        var svg = d3.select(selector).select(chartSelector);
        var ganttChartGroup = svg.select(".gantt-chart-container");

        var rect = ganttChartGroup.selectAll("rect").data(tasks, keyFunction);
        rect
            .enter()
            .insert("rect", ":first-child")
            .attr("class",
                function (d) {
                    var statusClass = taskStatus[d.status] || "bar";
                    var clickable = onClickBar ? "clickable" : "";
                    return statusClass + clickable;
                })
            .style("fill", function (d) { return d.color; });
        rect
            .attr("transform", rectTransform)
            .attr("height", function (d) { return y.rangeBand() - barPaddingBottom; })
            .attr("width", function (d) { return (x(d.endDate) - x(d.startDate)); });

        rect.exit().remove();

        var xAxisSvg = svg.select(".gantt-chart").select(".x");
        xAxisSvg.call(xAxis).selectAll('.tick');

        var xAxisSvg_2 = d3.select(xAxisSelector);
        xAxisSvg_2.select(".x").call(xAxis_2).selectAll('.tick');


        return gantt;
    };

    gantt.margin = function (value) {
        if (!arguments.length) return margin;
        margin = value;
        return gantt;
    };

    gantt.timeDomain = function (value) {
        if (!arguments.length) return [timeDomainStart, timeDomainEnd];
        timeDomainStart = +value[0], timeDomainEnd = +value[1];
        return gantt;
    };

    /**
     * @param {string}
     *                vale The value can be "fit" - the domain fits the data or
     *                "fixed" - fixed domain.
     */
    gantt.timeDomainMode = function (value) {
        if (!arguments.length) return timeDomainMode;
        timeDomainMode = value;
        return gantt;
    };

    gantt.taskTypes = function (value) {
        if (!arguments.length) return taskTypes;
        taskTypes = value;
        return gantt;
    };

    gantt.taskStatus = function (value) {
        if (!arguments.length) return taskStatus;
        taskStatus = value;
        return gantt;
    };

    gantt.width = function (value) {
        if (!arguments.length) return width;
        width = +value;
        return gantt;
    };

    gantt.height = function (value) {
        if (!arguments.length) return height;
        height = +value;
        return gantt;
    };

    gantt.tickFormat = function (value) {
        if (!arguments.length) return tickFormat;
        tickFormat = value;
        return gantt;
    };


    gantt.selector = function (value) {
        if (!arguments.length)
            return selector;
        selector = value;
        return gantt;
    };

    gantt.ticks = function (value) {
        if (!arguments.length)
            return ticks;
        ticks = value;
        return gantt;
    };


    gantt.margins = function (value) {
        if (!arguments.length)
            return margin;
        margin = value;
        return gantt;
    };

    gantt.barPaddingBottom = function (value) {
        if (!arguments.length)
            return barPaddingBottom;
        barPaddingBottom = value;
        return gantt;
    };

    gantt.minBarHeight = function (value) {
        if (!arguments.length)
            return minBarHeight;
        minBarHeight = value;
        return gantt;
    };

    gantt.maxBarHeight = function (value) {
        if (!arguments.length)
            return maxBarHeight;
        maxBarHeight = value;
        return gantt;
    };

    gantt.onClickBar = function (value) {
        if (!arguments.length)
            return onClickBar;
        onClickBar = value;
        return gantt;
    };

    gantt.tooltipFormatStartDate = function (callback) {
        if (!arguments.length)
            return tooltipFormatStartDate;
        tooltipFormatStartDate = callback;
        return gantt;
    };

    gantt.tooltipFormatEndDate = function (callback) {
        if (!arguments.length)
            return tooltipFormatEndDate;
            tooltipFormatEndDate = callback;
        return gantt;
    };

    gantt.tooltipValueFormat = function (callback) {
        if (!arguments.length)
            return tooltipValueFormat;
            tooltipValueFormat = callback;
        return gantt;
    };


    return gantt;
};
