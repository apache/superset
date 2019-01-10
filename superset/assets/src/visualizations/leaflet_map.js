import './leaflet_map.css';
// todo: use types to avoid full path of libs
import '../../node_modules/leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import * as L from '../../node_modules/leaflet/dist/leaflet.js';
import * as esri from '../../node_modules/esri-leaflet/dist/esri-leaflet.js';
import * as GRAPHICON from './graphIcon.js';
import { LegendComponent } from './legend_component.js';

/**
 * Leaflet Map Visualization
 * @param {*} slice
 * @param {*} payload
 */
function leafletmap(slice, payload) {

    console.log(slice, payload);
    const POLYGON = 'Polygon';
    const CONVEX = 'Convex';
    const CONCAVE = 'Concave';
    const POINT = 'Point';

    const formData = slice.formData;

    const MARKER_RADIUS = 10;
    const MARKER_WEIGHT = 1;
    const MARKER_OPACITY = 1;

    var colorCols;
    var geoJson;
    var mapInstance;
    var mapLayerType;
    var selectedColorColumn;
    var geoJsonLayer;
    var tooltipColumns = formData.all_columns_x;
    var enableClick = formData.chart_interactivity;
    var showTooltip = formData.rich_tooltip;
    var useEsriJS = formData.labels_outside;

    function getDefaultPolygonStyles() {
        return {
            color: getRgbColor(formData.stroke_color_picker),
            weight: MARKER_WEIGHT,
            opacity: MARKER_OPACITY,
            fillOpacity: formData.cell_size
        }
    }

    function getRgbColor(rgbObj) {
        return "rgb(" + rgbObj.r + "," + rgbObj.g + "," + rgbObj.b + "," + rgbObj.a + ")";
    }

    function setMapLayerType() {
        var map_style = formData.mapbox_style;
        var types = map_style.split('-');
        mapLayerType = (types.length == 2) ? types[1] : types[0];
        console.log(map_style, mapLayerType);
    }

    function setLayout() {
        const container = slice.container;
        // fix of leaflet js :: error
        //An error occurred while rendering the visualization: Error: Map container is already initialized.
        var el = container.el;
        if (el && el._leaflet_id) {
            el._leaflet_id = null;
        }
        container.css('height', slice.height());
        container.css('overflow', 'auto');
    }

    function createColorColumns() {
        // todo: current object is AdhocFilter,so propertynames are not match as we need
        // create AdhocColumn with correct names
        colorCols = {}
        if (formData.adhoc_columns && formData.adhoc_columns.length > 0) {
            formData.adhoc_columns.forEach(element => {
                colorCols[element['subject']] = element;
            });
        }

        selectedColorColumn = Object.keys(colorCols)[0];

    }

    function getTurfBasedGeoCordinates(points, type) {
        var turfPoints = [];
        points.forEach(element => {
            turfPoints.push(turf.point(element))
        });
        var turfFeatureCollection = turf.featureCollection(turfPoints);
        var hullFeature;
        if (type == CONVEX)
            hullFeature = turf.convex(turfFeatureCollection);
        else if (type == CONCAVE)
            hullFeature = turf.concave(turfFeatureCollection);

        return hullFeature ? hullFeature.geometry.coordinates : points;
    }

    function getMapCordinates(data) {
        const geoJsonField = formData.polygon;
        var points = JSON.parse(data[geoJsonField]);
        if (mapLayerType == POINT) {
            return (points.length > 0 && points[0] instanceof Array) ? points[0] : points;
        }
        else if (mapLayerType == CONVEX || mapLayerType == CONCAVE) {
            return getTurfBasedGeoCordinates(points, mapLayerType)
        } else {
            return [points];
        }
    }

    function getRangeValue(val, max, min) {
      val = val < min ? min : (val > max ? max : val);
      if(max - min === 0) {
        return 1;
      }
      return (val - min) / (max - min);
    }

    function colourGradientor(lowValueColor, highValueColor, colvalue, max, min){
        var rangeValue = getRangeValue(colvalue, parseFloat(max), parseFloat(min));
        var rgb = {}
        rgb.r = parseInt((highValueColor.r - lowValueColor.r) * rangeValue + lowValueColor.r)
        rgb.g = parseInt((highValueColor.g - lowValueColor.g) * rangeValue + lowValueColor.g)
        rgb.b = parseInt((highValueColor.b - lowValueColor.b) * rangeValue + lowValueColor.b)
        rgb.a = parseInt((highValueColor.a - lowValueColor.a) * rangeValue + lowValueColor.a)
        return 'rgb('+rgb.r +',' + rgb.g +',' +rgb.b +','+rgb.a + ')';
    }

    function getColorForColumnValue(colname, colvalue) {
        // todo: current object is AdhocFilter,so propertynames are not match as we need
        // create AdhocColumn with correct names
        var col = colorCols[colname];
        var minValue = col['operator'];
        var maxvalue = col['sqlExpression'];
        var minValueClr = col['comparator'];
        var maxValueClr = col['clause'];

        // todo: add algo to decrease /increase color intensity ad per value
        var colclr = colourGradientor(minValueClr, maxValueClr, colvalue,maxvalue,minValue);
        return colclr;
    }

    function getColumn(colname, colvalue) {
        return {
            'name': colname,
            'value': colvalue,
            'color': getColorForColumnValue(colname, colvalue)
        }
    }

    function getMapProperties(data) {
        const idfield = formData.geojson;
        var obj = { 'id': data[idfield] };
        for (const key in data) {
            if (data.hasOwnProperty(key) && colorCols.hasOwnProperty(key)) {
                obj[key] = getColumn(key, data[key])
            }
        }

        if (showTooltip) {
            obj.tooltip = getPopupContent(data)
        }
        if(formData.hasOwnProperty('all_columns_y') && formData.all_columns_y){
          obj.direction = data[formData.all_columns_y];
        }

        if(formData.hasOwnProperty('latitude') && formData.latitude){
          obj.markerValue = data[formData.latitude];
        }
        return obj;
    }

    function getMapGeometry(data) {

        return {
            'type': (mapLayerType == POINT) ? POINT : POLYGON,
            'coordinates': getMapCordinates(data)
        };
    }

    function getFeatureObject(data) {
        return {
            'type': 'Feature',
            'properties': getMapProperties(data),
            'geometry': getMapGeometry(data)
        }
    }

    function getFeatures() {
        var _data = payload.data.data;
        var feats = [];
        _data.forEach(element => {
            feats.push(getFeatureObject(element));
        });

        return feats;
    }


    function createMapDP() {
        geoJson = {
            'type': 'FeatureCollection',
            'features': getFeatures(),
        }
        console.log(geoJson);
    }

    function renderBasicMap() {

        const def_lat = formData.viewport_latitude;
        const def_long = formData.viewport_longitude;
        const def_zoom = formData.viewport_zoom;
        const def_mapserver = formData.ranges;
        const min_zoom = formData.min_radius;
        const max_zoom = formData.max_radius;

        mapInstance = L.map(slice.containerId, {
            minZoom: min_zoom,
            maxZoom: max_zoom
        }).setView([def_lat, def_long], def_zoom, {});

        if (useEsriJS) {
            // todo:add auth token support if nay required
            // handle error/show notification if wrong server pass
            esri.tiledMapLayer({
                url: def_mapserver,
                minZoom: min_zoom,
                maxZoom: max_zoom
            }).addTo(mapInstance);
        } else {
            L.tileLayer(def_mapserver, {}).addTo(mapInstance);
        }
    }

    function getSelection(event, property, cssClass){
      var selections = [];
      // remove previous selected layers except selected
      Object.values(event.target._map._targets).forEach(element => {
        if (element.hasOwnProperty(property) && element[property].classList.contains(cssClass)
          && event.target._leaflet_id != element._leaflet_id) {
            element[property].classList.remove(cssClass);
        }
      });
      if (event.target[property].classList.contains(cssClass)) {
        event.target[property].classList.remove(cssClass);
      } else {
        event.target[property].classList.add(cssClass);
        selections = [event.target.feature.properties.id];
      }
      return selections;
    }

    function mapItemClick(event) {
      if (enableClick) {
          var selections = [];
          if(event.target.hasOwnProperty('_path')){
            selections = getSelection(event, '_path', 'active-layer')
          } else if(event.target.hasOwnProperty('_icon')){
            selections = getSelection(event, '_icon', 'active-layer-canvas');
          }
          slice.addFilter(formData.geojson, selections, false);
      }
    }

    function getSelectedColorColumn() {
        return selectedColorColumn;
    }

    function getLayerStyles(feature) {
        var clr = feature.properties[getSelectedColorColumn()].color;
        var styles = Object.assign({}, getDefaultPolygonStyles());
        styles.fillColor = clr;
        return styles;
    }

    function getPopupContent(data) {
        let tooltip = "<div style='display:grid'>"
        for (let index = 0; index < tooltipColumns.length; index++) {
            const columnName = tooltipColumns[index];
            tooltip += "<span>";
            tooltip += "<b class='leaflet-tooltip-title'>" + columnName + "</b> : " + data[columnName];
            tooltip += "</span>";
        }
        tooltip += "</div>";
        return tooltip;
    }

    function renderPolygonLayer() {
        geoJsonLayer = L.geoJson(geoJson, {
            style: function (feature) {
                return getLayerStyles(feature);
            },

            onEachFeature: function onEachFeature(feature, layer) {
                layer.on({
                    click: mapItemClick
                });
                if (showTooltip) {
                    var layerPopup;
                    layer.on('mouseover', function (e) {
                        var coordinates = e.latlng;
                        var latlngArr = [coordinates.lat, coordinates.lng];
                        if (mapInstance) {
                            layerPopup = L.popup()
                                .setLatLng(latlngArr)
                                .setContent(e.target.feature.properties.tooltip)
                                .openOn(mapInstance);
                        }
                    });
                    layer.on('mouseout', function (e) {
                        if (layerPopup && mapInstance) {
                            mapInstance.closePopup(layerPopup);
                            layerPopup = null;
                        }
                    });
                }
            },
            pointToLayer: function (feature, latlng) {
              var styles = getLayerStyles(feature)
              styles.radius = MARKER_RADIUS;
              var node;
              if(feature.properties.hasOwnProperty('direction')){
                var myIcon = new GRAPHICON.ENB({
                  color: feature.properties[getSelectedColorColumn()].color,
                  directionValue: feature.properties.direction,
                  markerValue: feature.properties.markerValue,
                  className: 'my-div-icon',
                });
                node = L.marker(latlng, { icon: myIcon }).on('click', mapItemClick);
              } else {
                node = L.circleMarker(latlng, styles).on('click', mapItemClick);
              }
              return node;
            },
        }).addTo(mapInstance);
    }

    function changeColumn(event) {
        selectedColorColumn = event.target.value;
        mapInstance.removeLayer(geoJsonLayer);
        console.log(selectedColorColumn);
        renderPolygonLayer();
        addMapLegends();
    }
    function getColumnOptions() {
        var str = "<select>";
        for (const key in colorCols) {
            if (colorCols.hasOwnProperty(key)) {
                str += "<option>" + key + "</option>";
            }
        }
        str += "</select>";
        return str;
    }

    function addColumnsDropdownToMap() {

        if (Object.keys(colorCols).length > 1) {
            var legend = L.control({ position: 'topright' });
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'color_column_div');
                div.innerHTML = getColumnOptions();
                div.firstChild.onchange = changeColumn;
                return div;
            };
            legend.addTo(mapInstance);
        }
    }

    function drawMap() {
        renderBasicMap();
        renderPolygonLayer();
        addColumnsDropdownToMap();
        addMapLegends();
    }

    function addMapLegends(){
      var colname  = getSelectedColorColumn()
      var col = colorCols[colname];
      var legend = new LegendComponent({
        minValue: col['operator'],
        maxvalue: col['sqlExpression'],
        L: L,
        id: 'map-legend-container',
        getLegendColor: getLegendColor,
        mapInstance: mapInstance
      });
      legend.addMapLegend();
    }

    function getLegendColor(val){
      return getColorForColumnValue(getSelectedColorColumn(), val)
    }

    function init() {

        setLayout();
        setMapLayerType();
        createColorColumns();
        createMapDP();
        drawMap();
    }

    init();
}

module.exports = leafletmap;
