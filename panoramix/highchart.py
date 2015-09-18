from collections import defaultdict
import copy
from pandas.io.json import dumps


class BaseHighchart(object):
    stockchart = False
    tooltip_formatter = ""
    target_div = 'chart'

    @property
    def json(self):
        js = dumps(self.chart)
        return (
            js.replace('"{{TOOLTIP_FORMATTER}}"', self.tooltip_formatter)
            .replace("\n", " ")
        )

    @property
    def javascript_cmd(self):
        js = self.json
        if self.stockchart:
            return "new Highcharts.StockChart(%s);" % js
        return "new Highcharts.Chart(%s);" % js


class Highchart(BaseHighchart):
    def __init__(
            self, df,
            chart_type="spline",
            target_div="#chart",
            polar=False,
            width=None,
            height=None,
            show_legend=True,
            stockchart=False,
            title=None,
            tooltip=None,
            sort_columns=False,
            secondary_y=None,
            mark_right=False,
            compare=False,
            stacked=False,
            logx=False,
            logy=False,
            xlim=None,
            ylim=None,
            sort_legend_y=False,
            grid=False,
            zoom=None):
        self.df = df
        self.chart_type = chart_type
        self.chart = chart = {}
        self.stockchart = stockchart
        self.sort_columns = sort_columns
        self.secondary_y = secondary_y or []
        self.mark_right = mark_right
        self.compare = compare
        self.logx = logx
        self.logy = logy
        self.xlim = xlim
        self.ylim = ylim
        self.zoom = zoom
        self.polar = polar
        self.grid = grid
        self.stacked = stacked
        self.sort_legend_y = sort_legend_y

        chart['chart'] = {}
        chart['chart']["type"] = chart_type
        chart['chart']['renderTo'] = target_div

        if width:
            chart['chart']["width"] = width
        if height:
            chart['chart']["height"] = height

        chart['chart']['polar'] = polar

        chart["legend"] = {
            "enabled": show_legend
        }
        chart["title"] = {"text": title}

        if tooltip:
            chart['tooltip'] = tooltip
        if sort_legend_y:
            if 'tooltip' not in chart:
                chart['tooltip'] = {
                    #'formatter': "{{TOOLTIP_FORMATTER}}"
                }
        if self.zoom:
            chart["zoomType"] = self.zoom

        self.serialize_series()
        self.serialize_xaxis()
        self.serialize_yaxis()

        self.chart = chart

    @property
    def tooltip_formatter(self):
        if self.compare == 'percent':
            tf = """
            function() {
               var s = '<b>' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', new Date(this.x))+'</b><br/>';
               var sortedPoints = this.points.sort(function(a, b){
                     return ((a.point.change > b.point.change) ? -1 : ((a.point.change < b.point.change) ? 1 : 0));
               });
               $.each(sortedPoints , function(i, point) {
               s += '<span style="color:'+ point.series.color +'">\u25CF</span> ' + point.series.name + ': ' + f(point.y) + ' (<b>' + Highcharts.numberFormat(point.point.change, 2) + '%</b>)' + '<br/>';
               });

               return s;
            }
            """
        else:
            tf = """
            function() {
               var s = '<b>' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', new Date(this.x))+'</b><br/>';
               var sortedPoints = this.points.sort(function(a, b){
                     return ((a.y > b.y) ? -1 : ((a.y < b.y) ? 1 : 0));
               });
               $.each(sortedPoints , function(i, point) {
               s += '<span style="color:'+ point.series.color +'">\u25CF</span> ' + point.series.name + ': ' + f(point.y) + '<br/>';
               });

               return s;
            }
            """
        return tf

    def serialize_series(self):
        df = self.df
        chart = self.chart
        if self.sort_columns:
            df = df.sort_index()
        series = df.to_dict('series')
        chart["series"] = []
        for name, data in series.items():
            if df[name].dtype.kind not in "biufc":
                continue
            sec = name in self.secondary_y
            d = {
                "name":
                    name if not sec or self.mark_right else name + " (right)",
                "yAxis": int(sec),
                "data": zip(df.index, data.tolist())
            }
            if self.polar:
                d['data'] = [v for k, v in d['data']]
            if self.compare:
                d['compare'] = self.compare  # either `value` or `percent`
            if self.chart_type in ("area", "column", "bar") and self.stacked:
                d["stacking"] = 'normal'
            chart["series"].append(d)

    def serialize_xaxis(self):
        df = self.df
        x_axis = {
            'ordinal': False,
        }
        if df.index.name:
            x_axis["title"] = {"text": df.index.name}
        if df.index.dtype.kind in "M":
            x_axis["type"] = "datetime"
        if df.index.dtype.kind == 'O':
            x_axis['categories'] = sorted(
                list(df.index)) if self.sort_columns else list(df.index)
        if self.grid:
            x_axis["gridLineWidth"] = 1
            x_axis["gridLineDashStyle"] = "Dot"
        if self.logx:
            x_axis["type"] = 'logarithmic'
        if self.xlim:
            x_axis["min"] = self.xlim[0]
            x_axis["max"] = self.xlim[1]
        self.chart['xAxis'] = x_axis

    def serialize_yaxis(self):
        yAxis = {}
        chart = self.chart
        if self.grid:
            yAxis["gridLineWidth"] = 1
            yAxis["gridLineDashStyle"] = "Dot"
        if self.logy:
            yAxis["type"] = 'logarithmic'
        if self.ylim:
            yAxis["min"] = self.ylim[0]
            yAxis["max"] = self.ylim[1]
        chart["yAxis"] = [yAxis]
        if self.secondary_y:
            yAxis2 = copy.deepcopy(yAxis)
            yAxis2["opposite"] = True
            chart["yAxis"].append(yAxis2)


class HighchartBubble(BaseHighchart):
    def __init__(self, df, target_div=None, height=None):
        self.df = df
        self.chart = {
            'chart': {
                'type': 'bubble',
                'zoomType': 'xy'
            },
            'title': {'text': None},
            'plotOptions': {
                'bubble': {
                    'tooltip': {
                        'headerFormat': '<b>{series.name}</b><br>',
                        'pointFormat': '<b>{point.name}</b>: {point.x}, {point.y}, {point.z}'
                    }
                }
            },
        }
        chart = self.chart
        chart['series'] = self.series()
        chart['chart']['renderTo'] = target_div
        if height:
            chart['chart']["height"] = height

    def series(self):
        df = self.df
        series = defaultdict(list)
        for row in df.to_dict(orient='records'):
            series[row['group']].append(row)
        l = []
        for k, v in series.items():
            l.append({'data': v, 'name': k})
        return l
