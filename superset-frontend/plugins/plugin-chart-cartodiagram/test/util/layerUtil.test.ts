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

import { WfsLayerConf, WmsLayerConf, XyzLayerConf } from '../../src/types';
import {
  createLayer,
  createWfsLayer,
  createWmsLayer,
  createXyzLayer,
  escapeAttribution,
} from '../../src/util/layerUtil';

describe('layerUtil', () => {
  describe('escapeAttribution', () => {
    test('escapes HTML markup in attribution strings', () => {
      expect(escapeAttribution('(c) OSM <img src=x onerror=alert(1)>')).toBe(
        '(c) OSM &lt;img src=x onerror=alert(1)&gt;',
      );
      expect(escapeAttribution('a & "b" \'c\'')).toBe(
        'a &amp; &quot;b&quot; &#039;c&#039;',
      );
      expect(escapeAttribution(undefined)).toBeUndefined();
    });
  });

  describe('createWmsLayer', () => {
    test('exists', () => {
      // function is trivial
      expect(createWmsLayer).toBeDefined();
    });

    test('escapes HTML in the layer attribution', () => {
      const wmsLayerConf: WmsLayerConf = {
        title: 'wms',
        type: 'WMS',
        url: 'https://ows-demo.terrestris.de/geoserver/osm/wms',
        version: '1.3.0',
        layersParam: 'osm:osm-fuel',
        attribution: '(c) OSM <img src=x onerror=alert(1)>',
      };
      const layer = createWmsLayer(wmsLayerConf);
      const attributions = layer.getSource()?.getAttributions();
      expect(attributions?.(undefined as never)).toEqual([
        '(c) OSM &lt;img src=x onerror=alert(1)&gt;',
      ]);
    });
  });

  describe('createXyzLayer', () => {
    test('escapes HTML in the layer attribution', () => {
      const xyzLayerConf: XyzLayerConf = {
        title: 'osm',
        type: 'XYZ',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '(c) OSM <img src=x onerror=alert(1)>',
      };
      const layer = createXyzLayer(xyzLayerConf);
      const attributions = layer.getSource()?.getAttributions();
      expect(attributions?.(undefined as never)).toEqual([
        '(c) OSM &lt;img src=x onerror=alert(1)&gt;',
      ]);
    });
  });

  describe('createWfsLayer', () => {
    test('properly applies style', async () => {
      const colorToExpect = '#123456';
      const fillColor = '#ff0000';

      const wfsLayerConf: WfsLayerConf = {
        title: 'osm:osm-fuel',
        url: 'https://ows-demo.terrestris.de/geoserver/osm/wfs',
        type: 'WFS',
        version: '2.0.2',
        typeName: 'osm:osm-fuel',
        style: {
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
                  color: colorToExpect,
                },
                {
                  kind: 'Fill',
                  color: fillColor,
                },
              ],
            },
          ],
        },
      };

      const wfsLayer = await createWfsLayer(wfsLayerConf);

      const style = wfsLayer!.getStyle();
      // @ts-expect-error
      expect(style!.length).toEqual(3);

      // @ts-expect-error upgrade `ol` package for better type of StyleLike type.
      const colorAtLayer = style![2].getFill().getColor();
      expect(colorAtLayer).toEqual(fillColor);
    });
  });

  describe('createXyzLayer', () => {
    test('exists', () => {
      // function is trivial
      expect(createXyzLayer).toBeDefined();
    });
  });

  describe('createLayer', () => {
    test('exists', () => {
      expect(createLayer).toBeDefined();
    });
  });
});
