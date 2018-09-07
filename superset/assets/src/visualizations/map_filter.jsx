import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw';
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import Legend from './Legend';
import {
  getColorFromScheme,
  hexToRGB,
  rgbaToHex,
} from '../modules/colors';
import {
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM,
} from '../utils/common';
import './mapbox.css';

const NOOP = () => {};

/* getCategories()
 *
 * Steps through every feature in a geoJSON data set, looks at the
 * cat_color value and assigns the feature a "color" property.  It
 * also returns a dictionary mapping cat_color values to a colour.  This
 * can then be used, for instance, when rendering the legend.
 *
 * Args:
 * fd - Form data storing the user settings when creating the slice.
 * data - The data to be visualised, returned by the query.
 *
 * Returns:
 * A dictionary mapping values of the colour category to the colour
 * from the colour scheme.
 */
function getCategories(formData, queryData) {

  const c = formData.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColorRGBA = [c.r, c.g, c.b, 255 * c.a];
  const fixedColorHex = rgbaToHex(fixedColorRGBA);
  const categories = {};

  queryData.forEach((d) => {
    const featureProps = d.properties;
    if (featureProps.cat_color != null) {
      let color;
      if (!categories.hasOwnProperty(featureProps.cat_color)) {
        if (formData.dimension) {
          color = getColorFromScheme(
            featureProps.cat_color,
            formData.color_scheme,
          );
        } else {
          color = fixedColorHex;
        }
        categories[featureProps.cat_color] = {
          color: hexToRGB(color),
          hex: color,
          enabled: true,
        };
      }
    featureProps.color = categories[featureProps.cat_color].hex;
    }
  });
  return categories;
}

/* MapGLDraw
 *
 * An extension of the MapGL component that harnesses the power of
 * Mapbox visualisation tools to render the map filter.
 */
class MapGLDraw extends MapGL {

  componentDidMount() {
    super.componentDidMount();
    const map = this.getMap();
    const data = this.props.geoJSON;
    const slice = this.props.slice;
    const filters = this.props.slice.getFilters() || {}
    map.on('load', function () {

      // Displays the data distributions
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: {
          type: 'geojson',
          data,
        },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFF',
        },
      });

      // Displays the polygon drawing/selection controls
      this.draw = new MapboxDraw({
        displayControlsDefault: false,
          controls: {
          polygon: true,
          trash: true,
        },
      });
      map.addControl(this.draw, 'top-right');

        function updateFilter(e) {
            var featureCollection = [];
             if (e.features.length > 0){
               featureCollection = {
                 type: 'FeatureCollection',
                 features: e.features,
              }
           }
           slice.addFilter('geo', featureCollection,
                           false, true, 'geo_within');
        }

        for (var filter in filters){
            if(filter == "geo" && filters["geo"]["values"] !== []){

                this.draw.add(filters["geo"]["values"]);

                }

            }
        
      // Logs the polygon selection changes to console.
      map.on('draw.selectionchange', updateFilter);
      // Bug in mapbox-gl-draw doesn't fire selectionchange when deleteing
      map.on('draw.delete', function () {
        updateFilter(this.draw.getSelected());
      });
    });
  }

  componentWillUnmount() {
    const map = this.getMap();
    if (!map || !map.getStyle()) {
      return;
    }
    map.removeControl(this.draw);
  }

}

MapGLDraw.propTypes = Object.assign({}, MapGL.propTypes, {
  geoJSON: PropTypes.object,
});


/* MapFilter
 * A MapFilter component renders the map filter visualisation with all the
 * necessary configurations and, crucially, keeps a state for the component.
 */
class MapFilter extends React.Component {

  constructor(props) {
    super(props);
    const data = this.props.json.data;
    const longitude = data.viewportLongitude || DEFAULT_LONGITUDE;
    const latitude = data.viewportLatitude || DEFAULT_LATITUDE;
    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom: data.viewportZoom || DEFAULT_ZOOM,
        startDragLngLat: [longitude, latitude],
      },
    };
    this.colors = getCategories(
      this.props.slice.formData,
      this.props.json.data.geoJSON.features,
    );
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
    this.props.setControlValue('viewport_longitude', viewport.longitude);
    this.props.setControlValue('viewport_latitude', viewport.latitude);
    this.props.setControlValue('viewport_zoom', viewport.zoom);
  }

  render() {
    return (
      <MapGLDraw
        {...this.state.viewport}
        mapStyle={this.props.slice.formData.mapbox_style}
        width={this.props.slice.width()}
        height={this.props.slice.height()}
        slice={this.props.slice}
        mapboxApiAccessToken={this.props.json.data.mapboxApiKey}
        geoJSON={this.props.json.data.geoJSON}
        onViewportChange={this.onViewportChange}
      >
        <Legend
          position="br"
          categories={this.colors}
        />
      </MapGLDraw>
    );
  }
}

MapFilter.propTypes = {
  json: PropTypes.object,
  slice: PropTypes.object,
  //setControlValue: PropTypes.function,
};


/* mapFilter(slice, json, setControlValue)
 *
 * This is the hook called by superset to render the visualisation.  We are
 * given data associated with the slice and the JSON returned from the backend.
 * For simplicity all this data is passed to the MapFilter component.
 */
function mapFilter(slice, json, setControlValue) {

  const div = d3.select(slice.selector);
  div.selectAll('*').remove();

  ReactDOM.render(
    <MapFilter
      json={json}
      slice={slice}
      setControlValue={setControlValue || NOOP}
    />,
    div.node(),
  );
}

module.exports = mapFilter;
