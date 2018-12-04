import './leaflet_map.css';
// todo: use types to avoid full path of libs
import '../../node_modules/leaflet/dist/leaflet.css';
import * as  L from '../../node_modules/leaflet/dist/leaflet.js';
import * as turf from '@turf/turf';

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

    const MARKER_FILL_COLOR = getRgbColor(formData.color_picker);
    const MARKER_RADIUS = 10;
    const MARKER_WEIGHT = 1;
    const MARKER_OPACITY = 1;



    var colorCols;
    var geoJson;
    var mapInstance;
    var mapLayerType;
    var selectedColorColumn;
    var geoJsonLayer;

    function getDefaultPolygonStyles() {
        return {
            color: getRgbColor(formData.stroke_color_picker),
            fillColor: MARKER_FILL_COLOR,
            weight: MARKER_WEIGHT,
            opacity: MARKER_OPACITY,
            fillOpacity: formData.cell_size
        }
    }

    function getRgbColor(rgbObj){
        return "rgb("+rgbObj.r+","+rgbObj.g+","+rgbObj.b+","+rgbObj.a+")";
    }

    function setMapLayerType() {
        var map_style = formData.mapbox_style;
        var types = map_style.split('-');
        mapLayerType = (types.length == 2) ? types[1] : types[0];
        console.log(map_style, mapLayerType);
    }

    function setLayout() {
        const container = slice.container;
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

    function getColorForColumnVaule(colname, colvalue) {
        // todo: current object is AdhocFilter,so propertynames are not match as we need 
        // create AdhocColumn with correct names
        var col = colorCols[colname];
        var minValue = col['operator'];
        var maxvalue = col['sqlExpression'];
        var minValueClr = col['comparator'];
        var maxValueClr = col['clause'];

        // if  minValueClr is r,g,b,a typed Object
        if(minValueClr instanceof Object){
            minValueClr = getRgbColor(minValueClr);
        }

        // if  minValueClr is r,g,b,a typed Object
        if(maxValueClr instanceof Object){
            maxValueClr = getRgbColor(maxValueClr);
        }

        // todo: add algo to decrease /increase color intensity ad per value
        var colclr = minValueClr;
        if (colvalue >= maxvalue) {

            colclr = maxValueClr;
        } else if (colvalue < minValue) {
            colclr = MARKER_FILL_COLOR
        }
        
        return colclr;
    }

    function getColumn(colname, colvalue) {
        return {
            'name': colname,
            'value': colvalue,
            'color': getColorForColumnVaule(colname, colvalue)
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

        L.tileLayer(def_mapserver, {}).addTo(mapInstance);
    }

    function mapItemClick(event) {
        slice.addFilter(formData.geojson, [event.target.feature.properties.id], false);
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

    function getPopupContent(feature) {
        return "<div style='display:grid'><span><b>Details</b></span><span>" + formData.geojson + ' : ' + feature.properties.id + "</span><span>" + getSelectedColorColumn() + " : " + feature.properties[getSelectedColorColumn()].value + "</span></div>";
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
                // todo: move this to tooltip functionality
                layer.bindPopup(getPopupContent(feature));

            },
            pointToLayer: function (feature, latlng) {
                var styles = getLayerStyles(feature)
                styles.radius = MARKER_RADIUS;
                return L.circleMarker(latlng, styles).on('click', mapItemClick);
            },
        }).addTo(mapInstance);
    }

    function changeColumn(event) {
        selectedColorColumn = event.target.value;
        mapInstance.removeLayer(geoJsonLayer);
        console.log(selectedColorColumn);
        renderPolygonLayer();
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
