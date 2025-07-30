/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Style } from 'geostyler-style';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OlStyle from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Feature from 'ol/Feature';
import { DataLayerConf, WfsLayerConf } from '../../src/types';
import {
  createDataLayer,
  createLayer,
  createSelectionLayer,
  createWfsLayer,
  createWmsLayer,
  createXyzLayer,
  getSelectedFeatures,
  removeSelectionLayer,
  setSelectionBackgroundOpacity,
} from '../../src/util/layerUtil';
import { LAYER_NAME_PROP, SELECTION_LAYER_NAME } from '../../src/constants';

describe('layerUtil', () => {
  const circleColor = '#123456';

  const layerStyle: Style = {
    name: 'Default Style',
    rules: [
      {
        name: 'Default Rule',
        symbolizers: [
          {
            kind: 'Line',
            color: '#000000',
            width: 2,
          },
          {
            kind: 'Mark',
            wellKnownName: 'circle',
            color: circleColor,
          },
          {
            kind: 'Fill',
            color: '#000000',
          },
        ],
      },
    ],
  };

  const wfsLayerConf: WfsLayerConf = {
    title: 'osm:osm-fuel',
    url: 'https://ows-demo.terrestris.de/geoserver/osm/wfs',
    type: 'WFS',
    version: '2.0.2',
    typeName: 'osm:osm-fuel',
    style: layerStyle,
  };

  const dataLayerConf: DataLayerConf = {
    title: 'osm:osm-fuel',
    type: 'DATA',
    style: layerStyle,
  };

  const map = new Map();
  const dataLayerStyle = new OlStyle({
    fill: new Fill({
      color: '#aabbcc',
    }),
  });

  const matchingFeature = new Feature({
    foo: 'bar',
  });
  const nonMatchingFeature = new Feature({
    foo: 'baz',
  });
  const dataLayer = new VectorLayer({
    source: new VectorSource({
      features: [matchingFeature, nonMatchingFeature],
    }),
    style: dataLayerStyle,
  });

  const selectionLayer = createSelectionLayer([dataLayer], []);

  beforeEach(() => {
    map.setLayers([dataLayer, selectionLayer]);
  });

  describe('createWmsLayer', () => {
    it('exists', () => {
      // function is trivial
      expect(createWmsLayer).toBeDefined();
    });
  });

  describe('createWfsLayer', () => {
    it('properly applies style', async () => {
      const wfsLayer = await createWfsLayer(wfsLayerConf);

      const style = wfsLayer!.getStyle();
      // @ts-ignore
      expect(style!.length).toEqual(3);

      // @ts-ignore upgrade `ol` package for better type of StyleLike type.
      const colorAtLayer = style![1].getImage().getFill().getColor();
      expect(colorAtLayer).toEqual(circleColor);
    });
  });

  describe('createXyzLayer', () => {
    it('exists', () => {
      // function is trivial
      expect(createXyzLayer).toBeDefined();
    });
  });

  describe('createDataLayer', () => {
    it('properly applies style', async () => {
      const dataLayer = await createDataLayer(dataLayerConf);
      const style = dataLayer!.getStyle();
      // @ts-ignore
      expect(style!.length).toEqual(3);

      // @ts-ignore upgrade `ol` package for better type of StyleLike type.
      const colorAtLayer = style![1].getImage().getFill().getColor();
      expect(colorAtLayer).toEqual(circleColor);
    });
  });

  describe('createLayer', () => {
    it('exists', () => {
      expect(createLayer).toBeDefined();
    });
  });

  describe('removeSelectionLayer', () => {
    it('removes the selection layer from the map', () => {
      expect(map.getLayers().getArray()).toHaveLength(2);
      removeSelectionLayer(map);
      const selectionLayers = map
        .getLayers()
        .getArray()
        .filter(l => l.get(LAYER_NAME_PROP) === SELECTION_LAYER_NAME);
      expect(map.getLayers().getArray()).toHaveLength(1);
      expect(selectionLayers).toHaveLength(0);
    });

    it('does not remove other layers', () => {
      expect(map.getLayers().getArray()).toHaveLength(2);
      removeSelectionLayer(map);
      expect(map.getLayers().getArray()).toHaveLength(1);
      expect(map.getLayers().getArray()[0]).toEqual(dataLayer);
    });
  });

  describe('getSelectedFeatures', () => {
    it('returns the selected features from the data layers', () => {
      const selectedFeatures = getSelectedFeatures([dataLayer], {
        value: 'foo',
        selectedValues: 'bar',
      });
      expect(selectedFeatures).toHaveLength(1);
      expect(selectedFeatures[0]).toEqual(matchingFeature);
    });
  });

  describe('setSelectionBackgroundOopacity', () => {
    it('sets the opacity for the layers', () => {
      setSelectionBackgroundOpacity([dataLayer], 0.5);
      const opacity = dataLayer.getOpacity();
      expect(opacity).toEqual(0.5);
    });

    afterEach(() => {
      dataLayer.setOpacity(1); // Reset opacity after each test
    });
  });

  describe('createSelectionLayer', () => {
    it('creates a selection layer', () => {
      const features = [new Feature({ id: 1 }), new Feature({ id: 2 })];
      const selectionLayer = createSelectionLayer([dataLayer], features);
      expect(selectionLayer).toBeInstanceOf(VectorLayer);
      expect(selectionLayer.getSource()!.getFeatures()).toEqual(features);
      expect(selectionLayer.get(LAYER_NAME_PROP)).toEqual(SELECTION_LAYER_NAME);
    });

    it('applies the style of the first data layer', () => {
      const features: Feature[] = [];
      const selectionLayer = createSelectionLayer([dataLayer], features);
      const style = selectionLayer.getStyle();
      expect(style).toEqual(dataLayer.getStyle());
    });
  });
});
