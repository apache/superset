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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cloudLayout from 'd3-cloud';
import { scaleLinear } from 'd3-scale';
import { seed, CategoricalColorNamespace } from '@superset-ui/core';
import { SupersetTheme, withTheme } from '@apache-superset/core/ui';
import { isEqual } from 'lodash';

const seedRandom = seed('superset-ui');

export type PlainObject = Record<string, unknown>;

// Polyfill Word type since it's not exported from 'd3-cloud'
export type Word = {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
  weight?: string | number;
};

export const ROTATION = {
  flat: () => 0,
  random: () => Math.floor(seedRandom() * 6 - 3) * 30,
  square: () => Math.floor(seedRandom() * 2) * 90,
};

export type RotationType = keyof typeof ROTATION;

/**
 * Encoding configuration for mapping data fields to visual properties.
 * Supports field-based mappings with optional scale configurations.
 */
export interface WordCloudEncoding {
  color?: {
    field?: string;
    value?: string;
    scale?: { scheme?: string };
    type?: string;
  };
  fontFamily?: { field?: string; value?: string };
  fontSize?: {
    field?: string;
    value?: number;
    scale?: { range?: [number, number]; zero?: boolean };
    type?: string;
  };
  fontWeight?: { field?: string; value?: string | number };
  text?: { field?: string; value?: string };
}

export interface WordCloudVisualProps {
  encoding?: Partial<WordCloudEncoding>;
  rotation?: RotationType;
}

export interface WordCloudProps extends WordCloudVisualProps {
  data: PlainObject[];
  height: number;
  width: number;
  sliceId: number;
  colorScheme: string;
}

type FullWordCloudProps = WordCloudProps & { theme: SupersetTheme };

const SCALE_FACTOR_STEP = 0.5;
const MAX_SCALE_FACTOR = 3;
const TOP_RESULTS_PERCENTAGE = 0.1;

/**
 * Simple encoder that maps data fields to visual properties.
 * Replaces the encodable library with direct field access and d3 scales.
 */
class SimpleEncoder {
  private encoding: WordCloudEncoding;

  private defaults: {
    color: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string | number;
    text: string;
  };

  private fontSizeScale: ((value: number) => number) | null = null;

  constructor(
    encoding: WordCloudEncoding,
    defaults: {
      color: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: string | number;
      text: string;
    },
  ) {
    this.encoding = encoding;
    this.defaults = defaults;
  }

  /**
   * Set domain from dataset to configure scales
   */
  setDomainFromDataset(data: PlainObject[]): void {
    const fontSizeConfig = this.encoding.fontSize;
    if (fontSizeConfig?.field && fontSizeConfig?.scale?.range) {
      const values = data
        .map(d => Number(d[fontSizeConfig.field!]) || 0)
        .filter(v => !Number.isNaN(v));

      if (values.length > 0) {
        const min = fontSizeConfig.scale.zero ? 0 : Math.min(...values);
        const max = Math.max(...values);
        const [rangeMin, rangeMax] = fontSizeConfig.scale.range;

        this.fontSizeScale = scaleLinear()
          .domain([min, max])
          .range([rangeMin, rangeMax]);
      }
    }
  }

  getText(d: PlainObject): string {
    const config = this.encoding.text;
    if (config?.field && d[config.field] !== undefined) {
      return String(d[config.field]);
    }
    return config?.value ?? this.defaults.text;
  }

  getFontSize(d: PlainObject): number {
    const config = this.encoding.fontSize;
    if (config?.field && d[config.field] !== undefined) {
      const value = Number(d[config.field]) || 0;
      if (this.fontSizeScale) {
        return this.fontSizeScale(value);
      }
      return value || this.defaults.fontSize;
    }
    return config?.value ?? this.defaults.fontSize;
  }

  getColor(d: PlainObject): string {
    const config = this.encoding.color;
    if (config?.field && d[config.field] !== undefined) {
      return String(d[config.field]);
    }
    return config?.value ?? this.defaults.color;
  }

  getFontFamily(d: PlainObject): string {
    const config = this.encoding.fontFamily;
    if (config?.field && d[config.field] !== undefined) {
      return String(d[config.field]);
    }
    return config?.value ?? this.defaults.fontFamily;
  }

  getFontWeight(d: PlainObject): string | number {
    const config = this.encoding.fontWeight;
    if (config?.field && d[config.field] !== undefined) {
      return d[config.field] as string | number;
    }
    return config?.value ?? this.defaults.fontWeight;
  }
}

function WordCloud({
  data,
  encoding = {},
  width,
  height,
  rotation = 'flat',
  sliceId,
  colorScheme,
  theme,
}: FullWordCloudProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [scaleFactor] = useState(1);
  const isMountedRef = useRef(true);

  // Store previous props for comparison
  const prevPropsRef = useRef<{
    data: PlainObject[];
    encoding: Partial<WordCloudEncoding>;
    width: number;
    height: number;
    rotation: RotationType;
  } | null>(null);

  const createEncoder = useCallback(
    (enc?: Partial<WordCloudEncoding>): SimpleEncoder =>
      new SimpleEncoder(enc ?? {}, {
        color: theme.colorTextLabel,
        fontFamily: theme.fontFamily,
        fontSize: 20,
        fontWeight: 'bold',
        text: '',
      }),
    [theme.colorTextLabel, theme.fontFamily],
  );

  const setWordsIfMounted = useCallback((newWords: Word[]) => {
    if (isMountedRef.current) {
      setWords(newWords);
    }
  }, []);

  const generateCloud = useCallback(
    (
      encoder: SimpleEncoder,
      currentScaleFactor: number,
      isValid: (word: Word[]) => boolean,
    ) => {
      cloudLayout()
        .size([width * currentScaleFactor, height * currentScaleFactor])
        .words(data.map((d: Word) => ({ ...d })))
        .padding(5)
        .rotate(ROTATION[rotation] || ROTATION.flat)
        .text((d: PlainObject) => encoder.getText(d))
        .font((d: PlainObject) => encoder.getFontFamily(d))
        .fontWeight((d: PlainObject) => encoder.getFontWeight(d))
        .fontSize((d: PlainObject) => encoder.getFontSize(d))
        .on('end', (cloudWords: Word[]) => {
          if (isValid(cloudWords) || currentScaleFactor > MAX_SCALE_FACTOR) {
            setWordsIfMounted(cloudWords);
          } else {
            generateCloud(
              encoder,
              currentScaleFactor + SCALE_FACTOR_STEP,
              isValid,
            );
          }
        })
        .start();
    },
    [data, width, height, rotation, setWordsIfMounted],
  );

  const update = useCallback(() => {
    const encoder = createEncoder(encoding);
    encoder.setDomainFromDataset(data);

    const sortedData = [...data].sort(
      (a, b) => encoder.getFontSize(b) - encoder.getFontSize(a),
    );
    const topResultsCount = Math.max(
      sortedData.length * TOP_RESULTS_PERCENTAGE,
      10,
    );
    const topResults = sortedData.slice(0, topResultsCount);

    generateCloud(encoder, 1, (cloudWords: Word[]) =>
      topResults.every((d: PlainObject) =>
        cloudWords.find(({ text }) => encoder.getText(d) === text),
      ),
    );
  }, [data, encoding, createEncoder, generateCloud]);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial update on mount and when dependencies change
  useEffect(() => {
    const prevProps = prevPropsRef.current;
    const shouldUpdate =
      !prevProps ||
      !isEqual(prevProps.data, data) ||
      !isEqual(prevProps.encoding, encoding) ||
      prevProps.width !== width ||
      prevProps.height !== height ||
      prevProps.rotation !== rotation;

    if (shouldUpdate) {
      update();
    }

    prevPropsRef.current = { data, encoding, width, height, rotation };
  }, [data, encoding, width, height, rotation, update]);

  const encoder = useMemo(
    () => createEncoder(encoding),
    [createEncoder, encoding],
  );

  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const viewBoxWidth = width * scaleFactor;
  const viewBoxHeight = height * scaleFactor;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`-${viewBoxWidth / 2} -${viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <g>
        {words.map(w => (
          <text
            key={w.text}
            fontSize={`${w.size}px`}
            fontWeight={w.weight}
            fontFamily={w.font}
            fill={colorFn(encoder.getColor(w as PlainObject), sliceId)}
            textAnchor="middle"
            transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
          >
            {w.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

export default withTheme(WordCloud);
