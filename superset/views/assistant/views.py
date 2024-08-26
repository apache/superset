# Sample Assiststant Page

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.models.core import Database
from flask import current_app
from flask import request
import google.generativeai as genai
import logging


class AssistantView(BaseSupersetView):

    available_charts = """
        {
            "deck_arc": {
                "name": "deck.gl Arc",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Plot the distance (like flight paths) between origin and destination.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.ab8113ee.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.71df2d6f.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Geo",
                    "3D",
                    "Relational",
                    "Web"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_geojson": {
                "name": "deck.gl Geojson",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "The GeoJsonLayer takes in GeoJSON formatted data and renders it as interactive polygons, lines and points (circles, icons and/or texts).",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.0bdf08a4.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.197589e8.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "2D"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_grid": {
                "name": "deck.gl Grid",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Visualize geospatial data like 3D buildings, landscapes, or objects in grid view.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.e9235c2d.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.e9179e8a.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "3D",
                    "Comparison"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_hex": {
                "name": "deck.gl 3D Hexagon",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Overlays a hexagonal grid on a map, and aggregates data within the boundary of each cell.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.c501c39d.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.a260f7bd.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "3D",
                    "Geo",
                    "Comparison"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_heatmap": {
                "name": "deck.gl Heatmap",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Uses Gaussian Kernel Density Estimation to visualize spatial distribution of data",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.a923c837.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.789fda46.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Spatial",
                    "Comparison"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_multi": {
                "name": "deck.gl Multiple Layers",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Compose multiple layers together to form complex visuals.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.1e4e5b08.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.c37b40b5.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Multi-Layers"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_path": {
                "name": "deck.gl Path",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Visualizes connected points, which form a path, on a map.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.a5307f41.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.d9a48098.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Web"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_polygon": {
                "name": "deck.gl Polygon",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Visualizes geographic areas from your data as polygons on a Mapbox rendered map. Polygons can be colored using a metric.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.2b21fc4a.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.361d67a3.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "3D",
                    "Multi-Dimensions",
                    "Geo"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_scatter": {
                "name": "deck.gl Scatterplot",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "A map that takes rendering circles with a variable radius at latitude/longitude coordinates",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.f6ecb617.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.2f2c30c6.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Comparison",
                    "Scatter",
                    "2D",
                    "Geo",
                    "Intensity",
                    "Density"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_screengrid": {
                "name": "deck.gl Screen Grid",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Aggregates data within the boundary of grid cells and maps the aggregated values to a dynamic color scale",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.66ee99c5.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.7de75ac1.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Comparison",
                    "Intensity",
                    "Density"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "deck_contour": {
                "name": "deck.gl Contour",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://uber.github.io/deck.gl"
                ],
                "description": "Uses Gaussian Kernel Density Estimation to visualize spatial distribution of data",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.ace42983.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.d91f44db.png"
                    }
                ],
                "tags": [
                    "deckGL",
                    "Spatial",
                    "Comparison"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "area": {
                "name": "Time-series Area Chart (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "A time series chart that visualizes how a related metric from multiple groups vary over time. Each group is visualized using a different color.",
                "supportedAnnotationTypes": [
                    "INTERVAL",
                    "EVENT"
                ],
                "thumbnail": "/static/assets/thumbnail.8beef864.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.a58bab57.jpg",
                        "caption": "Stretched style"
                    },
                    {
                        "url": "/static/assets/example2.f881423e.jpg",
                        "caption": "Stacked style"
                    },
                    {
                        "url": "/static/assets/example3.3738f056.jpg",
                        "caption": "Video game consoles"
                    },
                    {
                        "url": "/static/assets/example4.94717fd8.jpg",
                        "caption": "Vehicle Types"
                    }
                ],
                "tags": [
                    "Comparison",
                    "Continuous",
                    "Legacy",
                    "Line",
                    "Percentages",
                    "Proportional",
                    "Stacked",
                    "Time",
                    "Trend",
                    "nvd3"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": "DEPRECATED",
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "bar": {
                "name": "Time-series Bar Chart (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Visualize how a metric changes over time using bars. Add a group by column to visualize group level metrics and how they change over time.",
                "supportedAnnotationTypes": [
                    "INTERVAL",
                    "EVENT"
                ],
                "thumbnail": "/static/assets/thumbnail.fb226195.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Time_Series_Bar_Chart.f6bb1a65.jpg"
                    },
                    {
                        "url": "/static/assets/Time_Series_Bar_Chart2.9b95dd4f.jpg"
                    },
                    {
                        "url": "/static/assets/Time_Series_Bar_Chart3.1605efdf.jpg"
                    }
                ],
                "tags": [
                    "Bar",
                    "Time",
                    "Trend",
                    "Stacked",
                    "Percentages",
                    "Proportional",
                    "Advanced-Analytics",
                    "nvd3",
                    "Legacy"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": "DEPRECATED",
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "big_number": {
                "name": "Big Number with Trendline",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Showcases a single number accompanied by a simple line chart, to call attention to an important metric along with its change over time or other dimension.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.1a9ace38.png",
                "useLegacyApi": false,
                "behaviors": [
                    "DRILL_TO_DETAIL"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Big_Number_Trendline.bccce4c1.jpg"
                    }
                ],
                "tags": [
                    "Advanced-Analytics",
                    "Line",
                    "Percentages",
                    "Featured",
                    "Report",
                    "Trend"
                ],
                "category": "KPI",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "big_number_total": {
                "name": "Big Number",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Showcases a single metric front-and-center. Big number is best used to call attention to a KPI or the one thing you want your audience to focus on.",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,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",
                "useLegacyApi": false,
                "behaviors": [
                    "DRILL_TO_DETAIL"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/BigNumber.b33901bf.jpg",
                        "caption": "A Big Number"
                    },
                    {
                        "url": "/static/assets/BigNumber2.3f1427c2.jpg",
                        "caption": "With a subheader"
                    }
                ],
                "tags": [
                    "Additive",
                    "Business",
                    "Legacy",
                    "Percentages",
                    "Featured",
                    "Report"
                ],
                "category": "KPI",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "box_plot": {
                "name": "Box Plot",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Also known as a box and whisker plot, this visualization compares the distributions of a related metric across multiple groups. The box in the middle emphasizes the mean, median, and inner 2 quartiles. The whiskers around each box visualize the min, max, range, and outer 2 quartiles.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.ee528db4.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/BoxPlot.1833526f.jpg"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Range",
                    "Statistical",
                    "Featured"
                ],
                "category": "Distribution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "bubble": {
                "name": "Bubble Chart (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.9d4c8d11.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.61c54865.jpg"
                    }
                ],
                "tags": [
                    "Multi-Dimensions",
                    "Comparison",
                    "Legacy",
                    "Scatter",
                    "Time",
                    "Trend",
                    "nvd3"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": "DEPRECATED",
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "bullet": {
                "name": "Bullet Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Showcases the progress of a single metric against a given target. The higher the fill, the closer the metric is to the target.",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIABAMAAAAGVsnJAAAALVBMVEX////l5eXLysrV1NRAiLny8vKFqcE9hriUkpSMr8e1q6Ovvspxbm7h0sDQ4u3/BU/sAAADYElEQVR42u3XwWubZRwH8L7CC1IMNJZAqF7qLj0ahrKDJxns2lcolGwHGejBf2BXW4i8JiMInjzssiFkTSmbMFZGbwMJbfHgQWLXw7yIFPY/mGqe581KlQaSKu3n09I+Df3+npcv75u878wMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwNiy8pRUytmZv1fGMeEC3n5vSq6OoTZOsQpQwAUvYP7KlavnWMCHn0/Jd2f17YkCqvv7u+dYwNM7U3L9jO7cPlHAwvObz8+zgOv/sRsf/1XAfLlcO/4xsPvW2vHfp39dwAJeOwOOK9jZqV2mS+DGyUug/FHv3z4FPphwAb//794EB28Cl/0+oOZG6PIVMPIhEN4M5/8+F17/VbvoZ0BtPlwAtVMqmJ/CGTC1x+FxDB5ys5WVyvB5N1upZP/4MJxN+nEYLrfSg2K5vvAorNOtg/fDuv5k42VYHyx2w3Ih69a3husXRTbdmonZ5PsiW3pUZBeebLwK+/YX45h04+XPYUzS/SSOGQyPY+pbB7XuJAtY3V4Oy9mlVjuWsddqhHXnh+Y3oZdWvh3KODza7jwcvtypx2yyV2RLPxXZeqPIvmg287Dv/WYck2x81usOx7yxvX0/jBkcWDOMeaczcgiTUF0tpvXbsdt6qxHLyPPHXxbro3CWrF472quG5Ei2W2TTdpEtNYpsqfm4F/YtNardMKb+rBnH9Deb8RD6m8WYZuNuPISJFFCNBZTWigIOe2uxgFbnXiggXS92f/OPo6/7YcpItjuSbRfZpFFkq6/u5WHfftb+NYzpvrsfxiTtXw7DmNJaNw9jss7aZAuY/Soub7U68bTPWp1P44mxnocd07yZh0tm84v8Wmv48t2dmC31fovZ2R+XYnZ1r8huPsifDfdNe53dMKbUW1xaCqf94NUw5lazE8f0W53b8RAmIS1urNJaUkxezuI6Wc6K26bl+P/luUo6F9ZZzKbl5ZhNylnMJpUiW65kcd/j26C5GE2TGF2ZO3XM3MghAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMKY/AbOwFea3ugBOAAAAAElFTkSuQmCC",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.2018d670.jpg"
                    }
                ],
                "tags": [
                    "Business",
                    "Legacy",
                    "Report",
                    "nvd3"
                ],
                "category": "KPI",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "cal_heatmap": {
                "name": "Calendar Heatmap",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://github.com/wa0x6e/cal-heatmap"
                ],
                "description": "Visualizes how a metric has changed over a time using a color scale and a calendar view. Gray values are used to indicate missing values and the linear color scheme is used to encode the magnitude of each day's value.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.5ec3e6bd.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.537c9da1.jpg"
                    }
                ],
                "tags": [
                    "Business",
                    "Comparison",
                    "Intensity",
                    "Pattern",
                    "Report",
                    "Trend"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "chord": {
                "name": "Chord Diagram",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://github.com/d3/d3-chord"
                ],
                "description": "Showcases the flow or link between categories using thickness of chords. The value and corresponding thickness can be different for each side.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.0fd3ce37.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/chord.446d549d.jpg",
                        "caption": "Relationships between community channels"
                    }
                ],
                "tags": [
                    "Circular",
                    "Legacy",
                    "Proportional",
                    "Relational"
                ],
                "category": "Flow",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "compare": {
                "name": "Time-series Percent Change",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Visualizes many different time-series objects in a single chart. This chart is being deprecated and we recommend using the Time-series Chart instead.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.b627d1a4.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.0df299a4.jpg"
                    }
                ],
                "tags": [
                    "Legacy",
                    "Time",
                    "nvd3",
                    "Advanced-Analytics",
                    "Comparison",
                    "Line",
                    "Percentages",
                    "Predictive",
                    "Trend"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "country_map": {
                "name": "Country Map",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://bl.ocks.org/john-guerra"
                ],
                "description": "Visualizes how a single metric varies across a country's principal subdivisions (states, provinces, etc) on a choropleth map. Each subdivision's value is elevated when you hover over the corresponding geographic boundary.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.b0251af6.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/exampleUsa.5007a9ac.jpg"
                    },
                    {
                        "url": "/static/assets/exampleGermany.db162ad7.jpg"
                    }
                ],
                "tags": [
                    "2D",
                    "Comparison",
                    "Geo",
                    "Range",
                    "Report",
                    "Stacked"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "dist_bar": {
                "name": "Bar Chart (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Compares metrics from different categories using bars. Bar lengths are used to indicate the magnitude of each value and color is used to differentiate groups.",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,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",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Bar_Chart.897135b4.jpg",
                        "caption": "Stacked style"
                    },
                    {
                        "url": "/static/assets/Bar_Chart_2.2db0caa4.jpg",
                        "caption": "Grouped style"
                    },
                    {
                        "url": "/static/assets/BarChart3.6c1382b7.jpg"
                    }
                ],
                "tags": [
                    "Additive",
                    "Bar",
                    "Categorical",
                    "Comparison",
                    "Legacy",
                    "Percentages",
                    "Stacked",
                    "nvd3"
                ],
                "category": "Ranking",
                "deprecated": false,
                "label": "DEPRECATED",
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "event_flow": {
                "name": "Event Flow",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://github.com/williaster/data-ui"
                ],
                "description": "Compares the lengths of time different activities take in a shared timeline view.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.52aeda65.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.1ec31bd3.jpg"
                    }
                ],
                "tags": [
                    "Legacy",
                    "Progressive"
                ],
                "category": "Flow",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "funnel": {
                "name": "Funnel Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Showcases how a metric changes as the funnel progresses. This classic chart is useful for visualizing drop-off between stages in a pipeline or lifecycle.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.f2cfa9c4.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.6f0d126b.jpg"
                    }
                ],
                "tags": [
                    "Business",
                    "ECharts",
                    "Progressive",
                    "Report",
                    "Sequential",
                    "Trend",
                    "Featured"
                ],
                "category": "KPI",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "sankey_v2": {
                "name": "Sankey Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "The Sankey chart visually tracks the movement and transformation of values across\n          system stages. Nodes represent stages, connected by links depicting value flow. Node\n          height corresponds to the visualized metric, providing a clear representation of\n          value distribution and transformation.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.a55df64a.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.7fb85f88.png"
                    },
                    {
                        "url": "/static/assets/example2.0ce27c6f.png"
                    }
                ],
                "tags": [
                    "Directional",
                    "Distribution",
                    "Flow"
                ],
                "category": "Flow",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "treemap_v2": {
                "name": "Treemap",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Show hierarchical relationships of data, with the value represented by area, showing proportion and contribution to the whole.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.8e8858da.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/treemap_v2_1.f997bb13.png"
                    },
                    {
                        "url": "/static/assets/treemap_v2_2.bac597e9.jpg"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Comparison",
                    "ECharts",
                    "Multi-Levels",
                    "Percentages",
                    "Proportional",
                    "Featured"
                ],
                "category": "Part of a Whole",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "gauge_chart": {
                "name": "Gauge Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Uses a gauge to showcase progress of a metric towards a target. The position of the dial represents the progress and the terminal value in the gauge represents the target value.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.154cdccd.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.b8069aef.jpg"
                    },
                    {
                        "url": "/static/assets/example2.65d169da.jpg"
                    }
                ],
                "tags": [
                    "Multi-Variables",
                    "Business",
                    "Comparison",
                    "ECharts",
                    "Report",
                    "Featured"
                ],
                "category": "KPI",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "graph_chart": {
                "name": "Graph Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Displays connections between entities in a graph structure. Useful for mapping relationships and showing which nodes are important in a network. Graph charts can be configured to be force-directed or circulate. If your data has a geospatial component, try the deck.gl Arc chart.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.a463d279.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.b2236be9.jpg"
                    }
                ],
                "tags": [
                    "Circular",
                    "Comparison",
                    "Directional",
                    "ECharts",
                    "Relational",
                    "Structural",
                    "Transformable",
                    "Featured"
                ],
                "category": "Flow",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "radar": {
                "name": "Radar Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Visualize a parallel set of metrics across multiple groups. Each group is visualized using its own line of points and each metric is represented as an edge in the chart.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.22e46caa.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.6c4d3e0c.jpg"
                    },
                    {
                        "url": "/static/assets/example2.ea481d57.jpg"
                    }
                ],
                "tags": [
                    "Business",
                    "Comparison",
                    "Multi-Variables",
                    "Report",
                    "Web",
                    "ECharts",
                    "Featured"
                ],
                "category": "Ranking",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "mixed_timeseries": {
                "name": "Mixed Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Visualize two different series using the same x-axis. Note that both series can be visualized with a different chart type (e.g. 1 using bars and 1 using a line).",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.d2ebb8b7.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.661644db.jpg"
                    }
                ],
                "tags": [
                    "Advanced-Analytics",
                    "ECharts",
                    "Line",
                    "Multi-Variables",
                    "Time",
                    "Transformable",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 2,
                "parseMethod": "json"
            },
            "heatmap": {
                "name": "Heatmap (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://bl.ocks.org/mbostock/3074470"
                ],
                "description": "Visualize a related metric across pairs of groups. Heatmaps excel at showcasing the correlation or strength between two groups. Color is used to emphasize the strength of the link between each pair of groups.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.e62c1972.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/transportation.75912cf2.jpg",
                        "caption": "Sizes of vehicles"
                    },
                    {
                        "url": "/static/assets/channels.99e7cde9.jpg",
                        "caption": "Relationships between community channels"
                    },
                    {
                        "url": "/static/assets/employment.7b5c16a7.jpg",
                        "caption": "Employment and education"
                    }
                ],
                "tags": [
                    "Business",
                    "Intensity",
                    "Legacy",
                    "Density",
                    "Predictive",
                    "Single Metric",
                    "Deprecated"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "histogram": {
                "name": "Histogram (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Take your data points, and group them into \"bins\" to see where the densest areas of information lie",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,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",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.44f08793.jpg",
                        "caption": "Population age data"
                    },
                    {
                        "url": "/static/assets/example2.19c795b0.jpg"
                    },
                    {
                        "url": "/static/assets/example3.99ab6fd0.jpg"
                    }
                ],
                "tags": [
                    "Comparison",
                    "Legacy",
                    "Pattern",
                    "Range"
                ],
                "category": "Distribution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "horizon": {
                "name": "Horizon Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://kmandov.github.io/d3-horizon-chart/"
                ],
                "description": "Compares how a metric changes over time between different groups. Each group is mapped to a row and change over time is visualized bar lengths and color.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.652ad50f.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Horizon_Chart.7b46c45c.jpg"
                    }
                ],
                "tags": [
                    "Legacy"
                ],
                "category": "Distribution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "line": {
                "name": "Time-series Line Chart (legacy)",
                "canBeAnnotationTypes": [
                    "TIME_SERIES"
                ],
                "canBeAnnotationTypesLookup": {
                    "TIME_SERIES": true
                },
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "Classic chart that visualizes how metrics change over time.",
                "supportedAnnotationTypes": [
                    "TIME_SERIES",
                    "INTERVAL",
                    "EVENT",
                    "FORMULA"
                ],
                "thumbnail": "/static/assets/thumbnail.3a51101f.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/LineChart.e0e66ab1.jpg"
                    },
                    {
                        "url": "/static/assets/LineChart2.32576bb2.jpg"
                    },
                    {
                        "url": "/static/assets/battery.8fed19b7.jpg",
                        "caption": "Battery level over time"
                    }
                ],
                "tags": [
                    "Legacy",
                    "nvd3"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": "DEPRECATED",
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "mapbox": {
                "name": "MapBox",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://www.mapbox.com/mapbox-gl-js/api/"
                ],
                "description": "",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.e7c50181.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/MapBox.6e6f79c8.jpg",
                        "description": "Light mode"
                    },
                    {
                        "url": "/static/assets/MapBox2.6337d5b5.jpg",
                        "description": "Dark mode"
                    }
                ],
                "tags": [
                    "Business",
                    "Intensity",
                    "Legacy",
                    "Density",
                    "Scatter",
                    "Transformable"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "paired_ttest": {
                "name": "Paired t-test Table",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Table that visualizes paired t-tests, which are used to understand statistical differences between groups.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.ab750ae6.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Legacy",
                    "Statistical",
                    "Tabular"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "para": {
                "name": "Parallel Coordinates",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://syntagmatic.github.io/parallel-coordinates"
                ],
                "description": "Plots the individual metrics for each row in the data vertically and links them together as a line. This chart is useful for comparing multiple metrics across all of the samples or rows in the data.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.f2d16e54.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.34be4dd6.jpg"
                    },
                    {
                        "url": "/static/assets/example2.f7e90b3e.jpg"
                    }
                ],
                "tags": [
                    "Directional",
                    "Legacy",
                    "Relational"
                ],
                "category": "Ranking",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "partition": {
                "name": "Partition Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Compare the same summarized metric across multiple groups.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.94dfb10d.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.f2f6c07c.jpg"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Comparison",
                    "Legacy",
                    "Proportional"
                ],
                "category": "Part of a Whole",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "pie": {
                "name": "Pie Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.\n\n        Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.c2670397.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Pie1.2cbe969f.jpg"
                    },
                    {
                        "url": "/static/assets/Pie2.42fece24.jpg"
                    },
                    {
                        "url": "/static/assets/Pie3.8c46d429.jpg"
                    },
                    {
                        "url": "/static/assets/Pie4.8bdccf82.jpg"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Circular",
                    "Comparison",
                    "Percentages",
                    "Featured",
                    "Proportional",
                    "ECharts",
                    "Nightingale"
                ],
                "category": "Part of a Whole",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "pivot_table_v2": {
                "name": "Pivot Table",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Used to summarize a set of data by grouping together multiple statistics along two axes. Examples: Sales numbers by region and month, tasks by status and assignee, active users by age and location. Not the most visually stunning visualization, but highly informative and versatile.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.b751c252.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.b4ba0c5a.jpg"
                    }
                ],
                "tags": [
                    "Additive",
                    "Report",
                    "Tabular",
                    "Featured"
                ],
                "category": "Table",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "rose": {
                "name": "Nightingale Rose Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "A polar coordinate chart where the circle is broken into wedges of equal angle, and the value represented by any wedge is illustrated by its area, rather than its radius or sweep angle.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.9905c92f.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.198466c2.jpg"
                    },
                    {
                        "url": "/static/assets/example2.5c0aa0f4.jpg"
                    }
                ],
                "tags": [
                    "Legacy",
                    "Advanced-Analytics",
                    "Circular",
                    "Multi-Layers",
                    "Pattern",
                    "Time",
                    "Trend"
                ],
                "category": "Ranking",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "sankey": {
                "name": "Sankey Diagram (legacy)",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://github.com/d3/d3-sankey"
                ],
                "description": "Visualizes the flow of different group's values through different stages of a system. New stages in the pipeline are visualized as nodes or layers. The thickness of the bars or edges represent the metric being visualized.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.39c29e21.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Sankey.25e6833c.jpg",
                        "description": "Demographics"
                    },
                    {
                        "url": "/static/assets/Sankey2.4083c192.jpg",
                        "description": "Survey Responses"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Directional",
                    "Legacy",
                    "Percentages",
                    "Proportional",
                    "Relational"
                ],
                "category": "Flow",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "table": {
                "name": "Table",
                "canBeAnnotationTypes": [
                    "EVENT",
                    "INTERVAL"
                ],
                "canBeAnnotationTypesLookup": {
                    "EVENT": true,
                    "INTERVAL": true
                },
                "credits": [],
                "description": "Classic row-by-column spreadsheet like view of a dataset. Use tables to showcase a view into the underlying data or to show aggregated metrics.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.0cdc0470.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Table.f8a6698c.jpg"
                    },
                    {
                        "url": "/static/assets/Table2.c8533c18.jpg"
                    },
                    {
                        "url": "/static/assets/Table3.8997ea72.jpg"
                    }
                ],
                "tags": [
                    "Additive",
                    "Business",
                    "Pattern",
                    "Featured",
                    "Report",
                    "Sequential",
                    "Tabular"
                ],
                "category": "Table",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "time_pivot": {
                "name": "Time-series Period Pivot",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://nvd3.org"
                ],
                "description": "",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.e556fb5f.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Legacy",
                    "Time",
                    "nvd3"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "time_table": {
                "name": "Time-series Table",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Compare multiple time series charts (as sparklines) and related metrics quickly.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.92b5826e.png",
                "useLegacyApi": true,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example.74513bdf.jpg"
                    }
                ],
                "tags": [
                    "Multi-Variables",
                    "Comparison",
                    "Legacy",
                    "Percentages",
                    "Tabular",
                    "Text",
                    "Trend"
                ],
                "category": "Table",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "word_cloud": {
                "name": "Word Cloud",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://github.com/jasondavies/d3-cloud"
                ],
                "description": "Visualizes the words in a column that appear the most often. Bigger font corresponds to higher frequency.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.aa9710fc.png",
                "useLegacyApi": false,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Word_Cloud.3d210efb.jpg"
                    },
                    {
                        "url": "/static/assets/Word_Cloud_2.2a94fb99.jpg"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Comparison",
                    "Density",
                    "Single Metric"
                ],
                "category": "Ranking",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "world_map": {
                "name": "World Map",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "http://datamaps.github.io/"
                ],
                "description": "A map of the world, that can indicate values in different countries.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.f5779edd.png",
                "useLegacyApi": true,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/WorldMap1.da13410b.jpg"
                    },
                    {
                        "url": "/static/assets/WorldMap2.2ace1986.jpg"
                    }
                ],
                "tags": [
                    "2D",
                    "Comparison",
                    "Intensity",
                    "Legacy",
                    "Multi-Dimensions",
                    "Multi-Layers",
                    "Multi-Variables",
                    "Scatter",
                    "Featured"
                ],
                "category": "Map",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "echarts_area": {
                "name": "Area Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Area charts are similar to line charts in that they represent variables with the same scale, but area charts stack the metrics on top of each other.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.4a9b5e62.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Area1.b13966ae.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Time",
                    "Line",
                    "Transformable",
                    "Stacked",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries": {
                "name": "Generic Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Swiss army knife for visualizing data. Choose between step, line, scatter, and bar charts. This viz type has many customization options as well.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.5d5ddfcc.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Time-series_Chart.8ff488d2.jpg"
                    }
                ],
                "tags": [
                    "Advanced-Analytics",
                    "Line",
                    "Predictive",
                    "Time",
                    "Transformable"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries_bar": {
                "name": "Bar Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Bar Charts are used to show metrics as a series of bars.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.0be12067.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Bar1.05db33fe.png"
                    },
                    {
                        "url": "/static/assets/Bar2.c41826d8.png"
                    },
                    {
                        "url": "/static/assets/Bar3.0ace6ce6.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Time",
                    "Transformable",
                    "Stacked",
                    "Bar",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries_line": {
                "name": "Line Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Line chart is used to visualize measurements taken over a given category. Line chart is a type of chart which displays information as a series of data points connected by straight line segments. It is a basic type of chart common in many fields.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.50c780c0.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Line1.7282d4c8.png"
                    },
                    {
                        "url": "/static/assets/Line2.c13c8aae.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Line",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries_smooth": {
                "name": "Smooth Line",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Smooth-line is a variation of the line chart. Without angles and hard edges, Smooth-line sometimes looks smarter and more professional.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.ea1ff627.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/SmoothLine1.97fed005.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Time",
                    "Line",
                    "Transformable"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries_scatter": {
                "name": "Scatter Plot",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Scatter Plot has the horizontal axis in linear units, and the points are connected in order. It shows a statistical relationship between two variables.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.3b5aef49.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Scatter1.665fe2f7.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Time",
                    "Transformable",
                    "Scatter",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "echarts_timeseries_step": {
                "name": "Stepped Line",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Stepped-line graph (also called step chart) is a variation of line chart but with the line forming a series of steps between data points. A step chart can be useful when you want to show the changes that occur at irregular intervals.",
                "supportedAnnotationTypes": [
                    "EVENT",
                    "FORMULA",
                    "INTERVAL",
                    "TIME_SERIES"
                ],
                "thumbnail": "/static/assets/thumbnail.e3f36081.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Step1.297e1ce0.png"
                    },
                    {
                        "url": "/static/assets/Step2.10e90fb7.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Predictive",
                    "Advanced-Analytics",
                    "Time",
                    "Transformable",
                    "Stacked"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "waterfall": {
                "name": "Waterfall Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "A waterfall chart is a form of data visualization that helps in understanding\n          the cumulative effect of sequentially introduced positive or negative values.\n          These intermediate values can either be time based or category based.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.2ec285ca.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.56ea6b14.png"
                    },
                    {
                        "url": "/static/assets/example2.15d8bad2.png"
                    },
                    {
                        "url": "/static/assets/example3.89a5d8fd.png"
                    }
                ],
                "tags": [
                    "Categorical",
                    "Comparison",
                    "ECharts",
                    "Featured"
                ],
                "category": "Evolution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "heatmap_v2": {
                "name": "Heatmap",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Visualize a related metric across pairs of groups. Heatmaps excel at showcasing the correlation or strength between two groups. Color is used to emphasize the strength of the link between each pair of groups.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.8d7d3cbe.png",
                "useLegacyApi": false,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.023a2d67.png"
                    },
                    {
                        "url": "/static/assets/example2.c63be840.png"
                    },
                    {
                        "url": "/static/assets/example3.8faa0540.png"
                    }
                ],
                "tags": [
                    "Business",
                    "Intensity",
                    "Density",
                    "Single Metric",
                    "ECharts",
                    "Featured"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "histogram_v2": {
                "name": "Histogram",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "The histogram chart displays the distribution of a dataset by\n          representing the frequency or count of values within different ranges or bins.\n          It helps visualize patterns, clusters, and outliers in the data and provides\n          insights into its shape, central tendency, and spread.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.6b7ac120.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.bd493731.png"
                    },
                    {
                        "url": "/static/assets/example2.1e997473.png"
                    }
                ],
                "tags": [
                    "Comparison",
                    "ECharts",
                    "Pattern",
                    "Range"
                ],
                "category": "Distribution",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "filter_select": {
                "name": "Select filter",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Select filter plugin using AntD",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYBAMAAABMSIXvAAADJWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzYwLCAyMDIwLzAyLzEzLTAxOjA3OjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQzZFMzI0Q0E5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQzZFMzI0REE5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkVDNkUzMjRBQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkVDNkUzMjRCQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ohw+vwAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAVUExURZCQkP//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",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "NATIVE_FILTER"
                ],
                "datasourceCount": 1,
                "enableNoResults": false,
                "exampleGallery": [],
                "tags": [
                    "Experimental"
                ],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "filter_range": {
                "name": "Range filter",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Range filter plugin using AntD",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYBAMAAABMSIXvAAADJWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzYwLCAyMDIwLzAyLzEzLTAxOjA3OjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQzZFMzI0Q0E5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQzZFMzI0REE5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkVDNkUzMjRBQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkVDNkUzMjRCQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ohw+vwAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAVUExURZCQkP//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",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "NATIVE_FILTER"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Experimental"
                ],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "filter_time": {
                "name": "Time filter",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Custom time filter plugin",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYBAMAAABMSIXvAAADJWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzYwLCAyMDIwLzAyLzEzLTAxOjA3OjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQzZFMzI0Q0E5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQzZFMzI0REE5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkVDNkUzMjRBQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkVDNkUzMjRCQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ohw+vwAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAVUExURZCQkP//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",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "NATIVE_FILTER"
                ],
                "datasourceCount": 0,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Experimental"
                ],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "filter_timecolumn": {
                "name": "Time column",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Time column filter plugin",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYBAMAAABMSIXvAAADJWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzYwLCAyMDIwLzAyLzEzLTAxOjA3OjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQzZFMzI0Q0E5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQzZFMzI0REE5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkVDNkUzMjRBQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkVDNkUzMjRCQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ohw+vwAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAVUExURZCQkP//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",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "NATIVE_FILTER"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Experimental"
                ],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "filter_timegrain": {
                "name": "Time grain",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Time grain filter plugin",
                "supportedAnnotationTypes": [],
                "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYBAMAAABMSIXvAAADJWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzYwLCAyMDIwLzAyLzEzLTAxOjA3OjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQzZFMzI0Q0E5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQzZFMzI0REE5MDIxMUVBOTY1Q0UwOTI2Mzk5MEY2NiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkVDNkUzMjRBQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkVDNkUzMjRCQTkwMjExRUE5NjVDRTA5MjYzOTkwRjY2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Ohw+vwAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAVUExURZCQkP//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",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "NATIVE_FILTER"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [],
                "tags": [
                    "Experimental"
                ],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "tree_chart": {
                "name": "Tree Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Visualize multiple levels of hierarchy using a familiar tree-like structure.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.9506c7f0.png",
                "useLegacyApi": false,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/tree.4b27c6bb.png"
                    }
                ],
                "tags": [
                    "Categorical",
                    "ECharts",
                    "Multi-Levels",
                    "Relational",
                    "Structural",
                    "Featured"
                ],
                "category": "Part of a Whole",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "sunburst_v2": {
                "name": "Sunburst Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Uses circles to visualize the flow of data through different stages of a system. Hover over individual paths in the visualization to understand the stages a value took. Useful for multi-stage, multi-group visualizing funnels and pipelines.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.241865fc.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART",
                    "DRILL_TO_DETAIL",
                    "DRILL_BY"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/Sunburst1.241865fc.png"
                    },
                    {
                        "url": "/static/assets/Sunburst2.3421fc35.png"
                    }
                ],
                "tags": [
                    "ECharts",
                    "Multi-Levels",
                    "Proportional",
                    "Featured"
                ],
                "category": "Part of a Whole",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json"
            },
            "handlebars": {
                "name": "Handlebars",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [],
                "description": "Write a handlebars template to render the data",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.b290682b.png",
                "useLegacyApi": false,
                "behaviors": [],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.297446aa.jpg"
                    },
                    {
                        "url": "/static/assets/example2.ef2d1091.jpg"
                    }
                ],
                "tags": [],
                "category": null,
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            },
            "bubble_v2": {
                "name": "Bubble Chart",
                "canBeAnnotationTypes": [],
                "canBeAnnotationTypesLookup": {},
                "credits": [
                    "https://echarts.apache.org"
                ],
                "description": "Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.",
                "supportedAnnotationTypes": [],
                "thumbnail": "/static/assets/thumbnail.a924bed4.png",
                "useLegacyApi": false,
                "behaviors": [
                    "INTERACTIVE_CHART"
                ],
                "datasourceCount": 1,
                "enableNoResults": true,
                "exampleGallery": [
                    {
                        "url": "/static/assets/example1.f68a646e.png"
                    },
                    {
                        "url": "/static/assets/example2.207fccfb.png"
                    }
                ],
                "tags": [
                    "Multi-Dimensions",
                    "Comparison",
                    "Scatter",
                    "Time",
                    "Trend",
                    "ECharts",
                    "Featured"
                ],
                "category": "Correlation",
                "deprecated": false,
                "label": null,
                "labelExplanation": null,
                "queryObjectCount": 1,
                "parseMethod": "json-bigint"
            }
        }
    """

    logger = logging.getLogger(__name__)
    datamodel = SQLAInterface(Database)
    route_base = "/assistant"
    default_view = "root"

    geminiApiKey = current_app.config.get("GEMINI_API_KEY")
    genai.configure(api_key=geminiApiKey)
    generationConfig = {
        "temperature": 1,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
    }

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=generationConfig,
        # safety_settings = Adjust safety settings
        # See https://ai.google.dev/gemini-api/docs/safety-settings
        )



    logger.info(f"GEMINI API Key: {geminiApiKey}")


    @expose("/")
    def root(self) -> FlaskResponse:
        """ Assistant Home Page """
        return self.render_app_template()
    
     # Api to interact with gemini and get table descriptions
    @expose("/gemini/table", methods=["POST"])
    @safe
    def gemini(self) -> FlaskResponse:
        
        """ Request schema 
        {
            data: string,
            table_name: string
        }
        """
        body = request.json
        data = body["data"]
        target = body["table_name"]
        chat_session = self.model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        f""" 
                        The following is a json schema containing data about a database Schema = {data}
                        Using the Data provided by the Schema Answer the question in the prompt below. in the following format.
                        Ensure the Format is a valid json format.
                        Format =
                            {{ 
                            "human_understandable: "The response should be assertive, The response should be a single line only and include column descriptions as well".
                            "llm_optimized":"The response should contain all relevant information that may be used by an llm to probe for more information. include data types and formats as well."
                            }}
                        """,
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        """
                        {{
                            "human_understandable":"The table 'bart_lines' contains data about different BART lines, including the line's name, color, a path represented in a JSON format and a polyline.", 
                            "llm_optimized":"The table 'bart_lines' contains data about different BART lines. Each row represents a different BART line. The columns contain the following information: 'name': the name of the BART line, 'color': the color of the BART line, 'path_json': the path of the BART line in JSON format, 'polyline': a polyline representing the path of the BART line."
                        }}
                        """
                    ],
                },
            ]
        )
        inputPrompt =   """
                        Prompt = Please give a reasonable description of the data contained in the table named {target}.
                    """

        response = chat_session.send_message(inputPrompt)
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)
    
    # Api to interact with gemini and get visualization suggestions
    @expose("/gemini/viz-suggestions", methods=["POST"])
    @safe
    def geminiViz(self) -> FlaskResponse:
        """ Request schema
        {
            data: string,
            purpose: string,
        }
        """
        body = request.json
        data = body["data"]
        purpose = body["purpose"]
        chat_session = self.model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        f"""
                        The following is a json schema containing data about a database Schema = {data}
                        The data contains information collected by by an organisation for the purpose of {purpose}
                        Using the Data provided by the Schema provide suggestions for visualizations that can be created from the data.
                        Avaliable visualizations are:{self.available_charts}
                        Order the suggestions according to importance and relevance to the organisation's purpose.
                        Response should be in the following format.
                        Avoid referencing the organisation or its purpose in the response.
                        Do not use data whose "selected" key is false.
                        Do not use tables whose "data" key is not present or is an empty list or dictionary.
                        Only use data from above to generate the response.
                        Format =
                        [
                            {{
                                "viz_type": "viz_type",
                                "description": "short on sentence description of the visualization in a way that a human can understand",
                                "reasoning": "reasoning behind the suggestion",
                                "llm_optimized": "descibe the visualization in a way that an llm can understand, include references to the data",
                                "viz_datasources": [
                                    "List of SQL queries that will be used as data sources for the visualization.
                                    The number of viz_datasource MUST be equal to the viz_type datasourceCount.
                                    The queries must be consistent with the data provided in the schema. For example, if the schema contains a table named 'bart_lines', the query should be 'SELECT * FROM bart_lines'.
                                    The queries should select only the columns that are relevant to the visualization. For example, if the visualization is a bar chart that shows the number of passengers per line, the query should be 'SELECT line_name, passengers FROM bart_lines'
                                    The queries should filter out nulls for the columns selected.
                                    The queries should ensure that castings are done only when necessary. and filteres added to support valid casting.
                                    "
                                ]
                            }}
                        ]
                        The response should be a valid json format.
                        """,
                        ],
                }
            ]
        )
        response = chat_session.send_message("Please provide suggestions for visualizations that can be created from the data.")
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)