import pandas
import copy
from pandas.io.json import dumps


class Highchart(object):
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
        if self.zoom:
            chart["zoomType"] = self.zoom

        self.serialize_series()
        self.serialize_xaxis()
        self.serialize_yaxis()

        self.chart = chart

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
                "name": name if not sec or self.mark_right else name + " (right)",
                "yAxis": int(sec),
                "data": zip(df.index, data.tolist())
            }
            if self.polar:
                d['data'] = [v for k, v in d['data']]
            if self.compare:
                d['compare'] = self.compare  # either `value` or `percent`
            if self.chart_type in ("area", "column", "bar") and self.stacked:
                d["stacking"] = 'normal'
            #if kwargs.get("style"):
            #    d["dashStyle"] = pd2hc_linestyle(kwargs["style"].get(name, "-"))
            chart["series"].append(d)

    def serialize_xaxis(self):
        df = self.df
        x_axis = {}
        if df.index.name:
            x_axis["title"] = {"text": df.index.name}
        if df.index.dtype.kind in "M":
            x_axis["type"] = "datetime"
        if df.index.dtype.kind == 'O':
            x_axis['categories'] = sorted(list(df.index)) if self.sort_columns else list(df.index)
            print list(df.index)
        if self.grid:
            x_axis["gridLineWidth"] = 1
            x_axis["gridLineDashStyle"] = "Dot"
        if self.logx:
            x_axis["type"] = 'logarithmic'
        if self.xlim:
            x_axis["min"] = self.xlim[0]
            x_axis["max"] = self.xlim[1]
        '''
        if "rot" in kwargs:
            x_axis["labels"] = {"rotation": kwargs["rot"]}
        if "fontsize" in kwargs:
            x_axis.setdefault("labels", {})["style"] = {"fontSize": kwargs["fontsize"]}
        if "xticks" in kwargs:
            x_axis["tickPositions"] = kwargs["xticks"]
        '''
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
        '''
        if "rot" in kwargs:
            yAxis["labels"] = {"rotation": kwargs["rot"]}
        if "fontsize" in kwargs:
            yAxis.setdefault("labels", {})["style"] = {"fontSize": kwargs["fontsize"]}
        if "yticks" in kwargs:
            yAxis["tickPositions"] = kwargs["yticks"]
        '''
        chart["yAxis"] = [yAxis]
        if self.secondary_y:
            yAxis2 = copy.deepcopy(yAxis)
            yAxis2["opposite"] = True
            chart["yAxis"].append(yAxis2)


    @property
    def javascript_cmd(self):
        js = dumps(self.chart)
        if self.stockchart:
            return "new Highcharts.StockChart(%s);" % js
        return "new Highcharts.Chart(%s);" %js
