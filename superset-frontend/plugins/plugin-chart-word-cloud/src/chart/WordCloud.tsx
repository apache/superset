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
import { PureComponent } from 'react';
import cloudLayout from 'd3-cloud';
import {
  PlainObject,
  createEncoderFactory,
  DeriveEncoding,
  Encoder,
} from 'encodable';
import {
  SupersetTheme,
  withTheme,
  seed,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import { isEqual } from 'lodash';

const seedRandom = seed('superset-ui');

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

export type WordCloudEncoding = DeriveEncoding<WordCloudEncodingConfig>;

type WordCloudEncodingConfig = {
  color: ['Color', string];
  fontFamily: ['Category', string];
  fontSize: ['Numeric', number];
  fontWeight: ['Category', string | number];
  text: ['Text', string];
};

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

export interface WordCloudState {
  words: Word[];
  scaleFactor: number;
}

const defaultProps: Required<WordCloudVisualProps> = {
  encoding: {},
  rotation: 'flat',
};

type FullWordCloudProps = WordCloudProps &
  typeof defaultProps & { theme: SupersetTheme };

const SCALE_FACTOR_STEP = 0.5;
const MAX_SCALE_FACTOR = 3;
const TOP_RESULTS_PERCENTAGE = 0.1;
class WordCloud extends PureComponent<FullWordCloudProps, WordCloudState> {
  static defaultProps = defaultProps;

  isComponentMounted = false;

  wordCloudEncoderFactory = createEncoderFactory<WordCloudEncodingConfig>({
    channelTypes: {
      color: 'Color',
      fontFamily: 'Category',
      fontSize: 'Numeric',
      fontWeight: 'Category',
      text: 'Text',
    },
    defaultEncoding: {
      color: { value: this.props.theme.colorTextLabel },
      fontFamily: { value: this.props.theme.fontFamily },
      fontSize: { value: 20 },
      fontWeight: { value: 'bold' },
      text: { value: '' },
    },
  });

  createEncoder = (
    encoding?: Partial<WordCloudEncoding>,
  ): Encoder<WordCloudEncodingConfig> => {
    const selector: (
      e: Partial<WordCloudEncoding>,
    ) => Encoder<WordCloudEncodingConfig> =
      this.wordCloudEncoderFactory.createSelector();

    return selector(encoding ?? {});
  };

  constructor(props: FullWordCloudProps) {
    super(props);
    this.state = {
      words: [],
      scaleFactor: 1,
    };
    this.setWords = this.setWords.bind(this);
  }

  componentDidMount() {
    this.isComponentMounted = true;
    this.update();
  }

  componentDidUpdate(prevProps: WordCloudProps) {
    const { data, encoding, width, height, rotation } = this.props;
    if (
      !isEqual(prevProps.data, data) ||
      !isEqual(prevProps.encoding, encoding) ||
      prevProps.width !== width ||
      prevProps.height !== height ||
      prevProps.rotation !== rotation
    ) {
      this.update();
    }
  }

  componentWillUnmount() {
    this.isComponentMounted = false;
  }

  setWords(words: Word[]) {
    if (this.isComponentMounted) {
      this.setState({ words });
    }
  }

  update() {
    const { data, encoding } = this.props;

    const encoder = this.createEncoder(encoding);
    encoder.setDomainFromDataset(data);

    const sortedData = [...data].sort(
      (a, b) =>
        encoder.channels.fontSize.encodeDatum(b, 0) -
        encoder.channels.fontSize.encodeDatum(a, 0),
    );
    const topResultsCount = Math.max(
      sortedData.length * TOP_RESULTS_PERCENTAGE,
      10,
    );
    const topResults = sortedData.slice(0, topResultsCount);

    this.generateCloud(encoder, 1, (words: Word[]) =>
      topResults.every((d: PlainObject) =>
        words.find(
          ({ text }) => encoder.channels.text.getValueFromDatum(d) === text,
        ),
      ),
    );
  }

  generateCloud(
    encoder: Encoder<WordCloudEncodingConfig>,
    scaleFactor: number,
    isValid: (word: Word[]) => boolean,
  ) {
    const { data, width, height, rotation } = this.props;

    cloudLayout()
      .size([width * scaleFactor, height * scaleFactor])
      .words(data.map((d: Word) => ({ ...d })))
      .padding(5)
      .rotate(ROTATION[rotation] || ROTATION.flat)
      .text((d: PlainObject) => encoder.channels.text.getValueFromDatum(d))
      .font((d: PlainObject) =>
        encoder.channels.fontFamily.encodeDatum(d, this.props.theme.fontFamily),
      )
      .fontWeight((d: PlainObject) =>
        encoder.channels.fontWeight.encodeDatum(d, 'normal'),
      )
      .fontSize((d: PlainObject) => encoder.channels.fontSize.encodeDatum(d, 0))
      .on('end', (words: Word[]) => {
        if (isValid(words) || scaleFactor > MAX_SCALE_FACTOR) {
          this.setWords(words);
        } else {
          this.generateCloud(encoder, scaleFactor + SCALE_FACTOR_STEP, isValid);
        }
      })
      .start();
  }

  render() {
    const { scaleFactor, words } = this.state;
    const { width, height, encoding, sliceId, colorScheme } = this.props;

    const encoder = this.createEncoder(encoding);
    encoder.channels.color.setDomainFromDataset(words);

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
              fill={colorFn(
                encoder.channels.color.getValueFromDatum(w) as string,
                sliceId,
              )}
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
}

export default withTheme(WordCloud);
