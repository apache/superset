import React from 'react';
import cloudLayout, { Word } from 'd3-cloud';
import { PlainObject, createEncoderFactory, DeriveEncoding, Encoder } from 'encodable';
import { SupersetThemeProps, withTheme, seedRandom } from '@superset-ui/core';

export const ROTATION = {
  flat: () => 0,
  // this calculates a random rotation between -90 and 90 degrees.
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

/**
 * These props should be stored when saving the chart.
 */
export interface WordCloudVisualProps {
  encoding?: Partial<WordCloudEncoding>;
  rotation?: RotationType;
}

export interface WordCloudProps extends WordCloudVisualProps {
  data: PlainObject[];
  height: number;
  width: number;
}

export interface WordCloudState {
  words: Word[];
  scaleFactor: number;
}

const defaultProps: Required<WordCloudVisualProps> = {
  encoding: {},
  rotation: 'flat',
};

type FullWordCloudProps = WordCloudProps & typeof defaultProps & SupersetThemeProps;

const SCALE_FACTOR_STEP = 0.5;
const MAX_SCALE_FACTOR = 3;
// Percentage of top results that will always be displayed.
// Needed to avoid clutter when shrinking a chart with many records.
const TOP_RESULTS_PERCENTAGE = 0.1;

class WordCloud extends React.PureComponent<FullWordCloudProps, WordCloudState> {
  static defaultProps = defaultProps;

  // Cannot name it isMounted because of conflict
  // with React's component function name
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
      color: { value: 'black' },
      fontFamily: { value: this.props.theme.typography.families.sansSerif },
      fontSize: { value: 20 },
      fontWeight: { value: 'bold' },
      text: { value: '' },
    },
  });

  createEncoder = this.wordCloudEncoderFactory.createSelector();

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
      prevProps.data !== data ||
      prevProps.encoding !== encoding ||
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
        encoder.channels.fontSize.encodeDatum(b, 0) - encoder.channels.fontSize.encodeDatum(a, 0),
    );
    const topResultsCount = Math.max(sortedData.length * TOP_RESULTS_PERCENTAGE, 10);
    const topResults = sortedData.slice(0, topResultsCount);

    // Ensure top results are always included in the final word cloud by scaling chart down if needed
    this.generateCloud(encoder, 1, (words: Word[]) =>
      topResults.every((d: PlainObject) =>
        words.find(({ text }) => encoder.channels.text.getValueFromDatum(d) === text),
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
      // clone the data because cloudLayout mutates input
      .words(data.map(d => ({ ...d })))
      .padding(5)
      .rotate(ROTATION[rotation] || ROTATION.flat)
      .text(d => encoder.channels.text.getValueFromDatum(d))
      .font(d =>
        encoder.channels.fontFamily.encodeDatum(d, this.props.theme.typography.families.sansSerif),
      )
      .fontWeight(d => encoder.channels.fontWeight.encodeDatum(d, 'normal'))
      .fontSize(d => encoder.channels.fontSize.encodeDatum(d, 0))
      .on('end', (words: Word[]) => {
        if (isValid(words) || scaleFactor > MAX_SCALE_FACTOR) {
          if (this.isComponentMounted) {
            this.setState({ words, scaleFactor });
          }
        } else {
          this.generateCloud(encoder, scaleFactor + SCALE_FACTOR_STEP, isValid);
        }
      })
      .start();
  }

  render() {
    const { scaleFactor } = this.state;
    const { width, height, encoding } = this.props;
    const { words } = this.state;

    const encoder = this.createEncoder(encoding);
    encoder.channels.color.setDomainFromDataset(words);

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
              fill={encoder.channels.color.encodeDatum(w, '')}
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
