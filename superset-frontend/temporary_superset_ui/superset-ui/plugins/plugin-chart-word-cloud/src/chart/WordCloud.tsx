import React from 'react';
import cloudLayout, { Word } from 'd3-cloud';
import { PlainObject, createEncoderFactory, DeriveEncoding } from 'encodable';
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
}

const defaultProps: Required<WordCloudVisualProps> = {
  encoding: {},
  rotation: 'flat',
};

type FullWordCloudProps = WordCloudProps & typeof defaultProps & SupersetThemeProps;

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
    const { data, width, height, rotation, encoding } = this.props;

    const encoder = this.createEncoder(encoding);
    encoder.setDomainFromDataset(data);

    cloudLayout()
      .size([width, height])
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
      .on('end', this.setWords)
      .start();
  }

  render() {
    const { width, height, encoding } = this.props;
    const { words } = this.state;

    const encoder = this.createEncoder(encoding);
    encoder.channels.color.setDomainFromDataset(words);

    return (
      <svg width={width} height={height}>
        <g transform={`translate(${width / 2},${height / 2})`}>
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
