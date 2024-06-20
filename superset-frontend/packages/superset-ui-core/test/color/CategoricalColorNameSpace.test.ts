/*
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

import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import {
  getNamespace,
  getScale,
  getColor,
  DEFAULT_NAMESPACE,
} from '../../src/color/CategoricalColorNamespace';

describe('CategoricalColorNamespace', () => {
  beforeAll(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'testColors',
        new CategoricalScheme({
          id: 'testColors',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .registerValue(
        'testColors2',
        new CategoricalScheme({
          id: 'testColors2',
          colors: ['red', 'green', 'blue'],
        }),
      );
  });
  it('The class constructor cannot be accessed directly', () => {
    expect(typeof CategoricalColorNamespace).not.toBe('Function');
  });
  describe('static getNamespace()', () => {
    it('returns default namespace if name is not specified', () => {
      const namespace = getNamespace();
      expect(namespace !== undefined).toBe(true);
      expect(namespace.name).toBe(DEFAULT_NAMESPACE);
    });
    it('returns namespace with specified name', () => {
      const namespace = getNamespace('myNamespace');
      expect(namespace !== undefined).toBe(true);
      expect(namespace.name).toBe('myNamespace');
    });
    it('returns existing instance if the name already exists', () => {
      const ns1 = getNamespace('myNamespace');
      const ns2 = getNamespace('myNamespace');
      expect(ns1).toBe(ns2);
      const ns3 = getNamespace();
      const ns4 = getNamespace();
      expect(ns3).toBe(ns4);
    });
  });
  describe('.getScale()', () => {
    it('returns a CategoricalColorScale from given scheme name', () => {
      const namespace = getNamespace('test-get-scale1');
      const scale = namespace.getScale('testColors');
      expect(scale).toBeDefined();
      expect(scale.getColor('dog')).toBeDefined();
    });
    it('returns a scale when a schemeId is not specified and there is no default key', () => {
      getCategoricalSchemeRegistry().clearDefaultKey();
      const namespace = getNamespace('new-space');
      const scale = namespace.getScale();
      expect(scale).toBeDefined();
      getCategoricalSchemeRegistry().setDefaultKey('testColors');
    });
  });
  describe('.setColor()', () => {
    it('overwrites color for all CategoricalColorScales in this namespace', () => {
      const namespace = getNamespace('test-set-scale1');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      expect(scale.getColor('dog')).toBe('black');
      expect(scale.getColor('boy')).not.toBe('black');
    });
    it('can override forcedColors in each scale', () => {
      const namespace = getNamespace('test-set-scale2');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      scale.setColor('dog', 'pink');
      expect(scale.getColor('dog')).toBe('pink');
      expect(scale.getColor('boy')).not.toBe('black');
    });
    it('does not affect scales in other namespaces', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      ns1.setColor('dog', 'black');
      const scale1 = ns1.getScale('testColors');
      const ns2 = getNamespace('test-set-scale3.2');
      const scale2 = ns2.getScale('testColors');
      expect(scale1.getColor('dog')).toBe('black');
      expect(scale2.getColor('dog')).not.toBe('black');
    });
    it('returns the namespace instance', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      const ns2 = ns1.setColor('dog', 'black');
      expect(ns1).toBe(ns2);
    });
    it('should reset colors', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      ns1.setColor('dog', 'black');
      ns1.resetColors();
      expect(ns1.forcedItems).toMatchObject({});
    });
  });
  describe('static getScale()', () => {
    it('getScale() returns a CategoricalColorScale with default scheme in default namespace', () => {
      const scale = getScale();
      expect(scale).toBeDefined();
      const scale2 = getNamespace().getScale();
      expect(scale2).toBeDefined();
    });
    it('getScale(scheme) returns a CategoricalColorScale with specified scheme in default namespace', () => {
      const scale = getNamespace().getScale('testColors');
      expect(scale).toBeDefined();
    });
    it('getScale(scheme, namespace) returns a CategoricalColorScale with specified scheme in specified namespace', () => {
      const scale = getNamespace('test-getScale').getScale('testColors');
      expect(scale).toBeDefined();
    });
  });
  describe('static getColor()', () => {
    it('getColor(value) returns a color from default scheme in default namespace', () => {
      const value = 'dog';
      const color = getColor(value);
      const color2 = getNamespace().getScale().getColor(value);
      expect(color).toBe(color2);
    });
    it('getColor(value, scheme) returns a color from specified scheme in default namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const color = getColor(value, scheme);
      const color2 = getNamespace().getScale(scheme).getColor(value);
      expect(color).toBe(color2);
    });
    it('getColor(value, scheme, namespace) returns a color from specified scheme in specified namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const namespace = 'test-getColor';
      const color = getColor(value, scheme, namespace);
      const color2 = getNamespace(namespace).getScale(scheme).getColor(value);
      expect(color).toBe(color2);
    });
  });
});
