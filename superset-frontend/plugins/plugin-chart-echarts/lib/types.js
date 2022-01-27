export var ForecastSeriesEnum;
(function (ForecastSeriesEnum) {
    ForecastSeriesEnum["Observation"] = "";
    ForecastSeriesEnum["ForecastTrend"] = "__yhat";
    ForecastSeriesEnum["ForecastUpper"] = "__yhat_upper";
    ForecastSeriesEnum["ForecastLower"] = "__yhat_lower";
})(ForecastSeriesEnum || (ForecastSeriesEnum = {}));
export var LegendOrientation;
(function (LegendOrientation) {
    LegendOrientation["Top"] = "top";
    LegendOrientation["Bottom"] = "bottom";
    LegendOrientation["Left"] = "left";
    LegendOrientation["Right"] = "right";
})(LegendOrientation || (LegendOrientation = {}));
export var LegendType;
(function (LegendType) {
    LegendType["Scroll"] = "scroll";
    LegendType["Plain"] = "plain";
})(LegendType || (LegendType = {}));
export const DEFAULT_LEGEND_FORM_DATA = {
    legendMargin: null,
    legendOrientation: LegendOrientation.Top,
    legendType: LegendType.Scroll,
    showLegend: false,
};
export var LabelPositionEnum;
(function (LabelPositionEnum) {
    LabelPositionEnum["Top"] = "top";
    LabelPositionEnum["Left"] = "left";
    LabelPositionEnum["Right"] = "right";
    LabelPositionEnum["Bottom"] = "bottom";
    LabelPositionEnum["Inside"] = "inside";
    LabelPositionEnum["InsideLeft"] = "insideLeft";
    LabelPositionEnum["InsideRight"] = "insideRight";
    LabelPositionEnum["InsideTop"] = "insideTop";
    LabelPositionEnum["InsideBottom"] = "insideBottom";
    LabelPositionEnum["InsideTopLeft"] = "insideTopLeft";
    LabelPositionEnum["InsideBottomLeft"] = "insideBottomLeft";
    LabelPositionEnum["InsideTopRight"] = "insideTopRight";
    LabelPositionEnum["InsideBottomRight"] = "insideBottomRight";
})(LabelPositionEnum || (LabelPositionEnum = {}));
export const DEFAULT_TITLE_FORM_DATA = {
    xAxisTitle: '',
    xAxisTitleMargin: 0,
    yAxisTitle: '',
    yAxisTitleMargin: 0,
    yAxisTitlePosition: 'Top',
};
export * from './Timeseries/types';
//# sourceMappingURL=types.js.map