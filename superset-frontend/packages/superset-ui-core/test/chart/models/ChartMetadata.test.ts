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

import { ChartMetadata } from '@superset-ui/core';

describe('ChartMetadata', () => {
  it('exists', () => {
    expect(ChartMetadata).toBeDefined();
  });
  describe('new ChartMetadata({})', () => {
    it('creates new metadata instance', () => {
      const metadata = new ChartMetadata({
        name: 'test chart',
        credits: [],
        description: 'some kind of chart',
        thumbnail: 'test.png',
      });
      expect(metadata).toBeInstanceOf(ChartMetadata);
    });
  });
  describe('.canBeAnnotationType(type)', () => {
    const metadata = new ChartMetadata({
      name: 'test chart',
      canBeAnnotationTypes: ['event'],
      credits: [],
      description: 'some kind of chart',
      thumbnail: 'test.png',
    });
    it('returns true if can', () => {
      expect(metadata.canBeAnnotationType('event')).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(metadata.canBeAnnotationType('invalid-type')).toBeFalsy();
    });
  });
  describe('.clone()', () => {
    const metadata = new ChartMetadata({
      name: 'test chart',
      canBeAnnotationTypes: ['event'],
      credits: [],
      description: 'some kind of chart',
      thumbnail: 'test.png',
    });
    const clone = metadata.clone();

    it('returns a new instance', () => {
      expect(metadata).not.toBe(clone);
    });
    it('returns a new instance with same field values', () => {
      expect(metadata.name).toEqual(clone.name);
      expect(metadata.credits).toEqual(clone.credits);
      expect(metadata.description).toEqual(clone.description);
      expect(metadata.canBeAnnotationTypes).toEqual(clone.canBeAnnotationTypes);
      expect(metadata.thumbnail).toEqual(clone.thumbnail);
    });
  });
});
