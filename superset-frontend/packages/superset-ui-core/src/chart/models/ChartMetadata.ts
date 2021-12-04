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

import { Behavior } from '../types/Base';

interface LookupTable {
  [key: string]: boolean;
}

export interface ExampleImage {
  url: string;
  caption?: string;
}

export interface ChartMetadataConfig {
  name: string;
  canBeAnnotationTypes?: string[];
  credits?: string[];
  description?: string;
  datasourceCount?: number;
  enableNoResults?: boolean;
  show?: boolean;
  supportedAnnotationTypes?: string[];
  thumbnail: string;
  useLegacyApi?: boolean;
  behaviors?: Behavior[];
  deprecated?: boolean;
  exampleGallery?: ExampleImage[];
  tags?: string[];
  category?: string | null;
}

export default class ChartMetadata {
  name: string;

  canBeAnnotationTypes?: string[];

  canBeAnnotationTypesLookup: LookupTable;

  credits: string[];

  description: string;

  show: boolean;

  supportedAnnotationTypes: string[];

  thumbnail: string;

  useLegacyApi: boolean;

  behaviors: Behavior[];

  datasourceCount: number;

  enableNoResults: boolean;

  deprecated: boolean;

  exampleGallery: ExampleImage[];

  tags: string[];

  category: string | null;

  constructor(config: ChartMetadataConfig) {
    const {
      name,
      canBeAnnotationTypes = [],
      credits = [],
      description = '',
      show = true,
      supportedAnnotationTypes = [],
      thumbnail,
      useLegacyApi = false,
      behaviors = [],
      datasourceCount = 1,
      enableNoResults = true,
      deprecated = false,
      exampleGallery = [],
      tags = [],
      category = null,
    } = config;

    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotationTypes = canBeAnnotationTypes;
    this.canBeAnnotationTypesLookup = canBeAnnotationTypes.reduce(
      (prev: LookupTable, type: string) => {
        const lookup = prev;
        lookup[type] = true;

        return lookup;
      },
      {},
    );
    this.supportedAnnotationTypes = supportedAnnotationTypes;
    this.thumbnail = thumbnail;
    this.useLegacyApi = useLegacyApi;
    this.behaviors = behaviors;
    this.datasourceCount = datasourceCount;
    this.enableNoResults = enableNoResults;
    this.deprecated = deprecated;
    this.exampleGallery = exampleGallery;
    this.tags = tags;
    this.category = category;
  }

  canBeAnnotationType(type: string): boolean {
    return this.canBeAnnotationTypesLookup[type] || false;
  }

  clone() {
    return new ChartMetadata(this);
  }
}
