import { css, StyleSheet } from 'aphrodite';
import React from 'react';
import PropTypes from 'prop-types';

import { Button, Select, StepIncrementer } from '@data-ui/forms';

import EventTypeLegend from './EventTypeLegend';
import EventTypeRadialChart from './EventTypeRadialChart';

import { scaleShape, xScaleTypeShape } from '../propShapes';
import formatIncrementerValue from '../utils/formatIncrementerValue';
import { fontFamily } from '../theme';

import {
  ANY_EVENT_TYPE,
  ELAPSED_TIME_SCALE,
  EVENT_SEQUENCE_SCALE,
  FILTERED_EVENTS,
  ORDER_BY_EVENT_COUNT,
  ORDER_BY_ELAPSED_MS,
} from '../constants';

export const width = 300;

const unit = 8;
const padding = 2 * unit;
const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    fontFamily,
    fontSize: 12,
    fontColor: '#767676',
    width: 'auto',
    height: '100%',
    padding: `${0}px ${padding}px`,
    background: '#fff',
  },

  innerContainer: {
    overflowY: 'auto',
    height: 'inherit',
  },

  flexRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  flexColumn: {
    display: 'flex',
    flexDirection: 'column',
  },

  alignBySelect: {
    paddingLeft: Number(unit),
    fontWeight: 700,
    flexGrow: 1,
  },

  header: {
    position: 'absolute',
    top: 0,
    right: '100%',
    textAlign: 'right',
  },

  padBottom: {
    paddingBottom: padding,
  },

  option: {
    display: 'flex',
    alignItems: 'center',
  },

  optionLegend: {
    flexShrink: 0,
    color: 'inherit',
    background: 'currentColor',
    width: 12,
    height: 12,
    borderRadius: '50%',
    marginRight: 8,
  },

  title: {
    fontWeight: 700,
    fontSize: 14,
  },

  subTitle: {
    fontWeight: 200,
    fontSize: 12,
  },
});

const propTypes = {
  alignByIndex: PropTypes.number,
  alignByEventType: PropTypes.string.isRequired,
  orderBy: PropTypes.string.isRequired,
  colorScale: scaleShape.isRequired,
  xScaleType: xScaleTypeShape.isRequired,
  minEventCount: PropTypes.number,
  showControls: PropTypes.bool,
  hiddenEventTypes: PropTypes.objectOf(PropTypes.bool),
  metaData: PropTypes.shape({
    hiddenNodes: PropTypes.object,
    hiddenEvents: PropTypes.object,
    eventCountLookup: PropTypes.object,
    eventCountTotal: PropTypes.number,
    eventCountArray: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
      }),
    ),
  }),
  onChangeXScale: PropTypes.func,
  onToggleShowControls: PropTypes.func,
  onChangeAlignByIndex: PropTypes.func,
  onChangeAlignByEventType: PropTypes.func,
  onChangeOrderBy: PropTypes.func,
  onChangeMinEventCount: PropTypes.func,
  onClickLegendShape: PropTypes.func,
};

const defaultProps = {
  onChangeXScale: () => {},
  onToggleShowControls: () => {},
  onChangeAlignByIndex: () => {},
  onChangeAlignByEventType: () => {},
  onChangeOrderBy: () => {},
  onChangeMinEventCount: () => {},
  onClickLegendShape: () => {},
  alignByIndex: 0,
  minEventCount: 1,
  metaData: {
    hiddenNodes: {},
    hiddenEvents: {},
    eventCountLookup: {},
    eventCountTotal: 0,
    eventCountArray: [],
  },
  hiddenEventTypes: {},
  showControls: true,
};

function ControlPanel({
  showControls,
  alignByIndex,
  alignByEventType,
  orderBy,
  xScaleType,
  colorScale,
  minEventCount,
  onToggleShowControls,
  onChangeAlignByEventType,
  onChangeAlignByIndex,
  onChangeXScale,
  onChangeOrderBy,
  onChangeMinEventCount,
  onClickLegendShape,
  metaData,
  hiddenEventTypes,
}) {
  const eventTypeOptions = [
    { value: ANY_EVENT_TYPE, label: 'event' },
    ...colorScale.scale.domain().map(value => ({ value, label: value })),
  ];

  // option renderer
  const valueRenderer = option => {
    if (option.value === ANY_EVENT_TYPE) return option.label;
    const color = colorScale.scale(option.value);

    return (
      <div className={css(styles.option)} style={{ color }}>
        <div className={css(styles.optionLegend)} />
        {option.label}
      </div>
    );
  };

  // sort legend by value and remove filter from color scale if no items are filtered
  const legendScale = colorScale.scale.copy();
  const removeFiltered = !metaData.eventCountLookup[FILTERED_EVENTS];
  const domain = (removeFiltered ? legendScale.domain().slice(1) : legendScale.domain()).sort(
    (a, b) => metaData.eventCountLookup[b] - metaData.eventCountLookup[a],
  );
  const range = domain.map(eventName => legendScale(eventName));
  legendScale.domain(domain).range(range);

  const hiddenEventCount = Object.keys(metaData.hiddenEvents).length;
  const hiddenEventPerc = (hiddenEventCount / (hiddenEventCount + metaData.eventCountTotal)) * 100;

  return (
    <div className={css(styles.outerContainer)}>
      <div className={css(styles.header)}>
        <Button onClick={onToggleShowControls} small>
          {showControls ? <span>{'Hide >'}</span> : <span>{'< Controls'}</span>}
        </Button>
      </div>

      {showControls && (
        <div className={css(styles.innerContainer)}>
          <div className={css(styles.padBottom)}>
            <div className={css(styles.title)}>Align sequences by</div>
            <div className={css(styles.flexRow)}>
              <StepIncrementer
                min={-5}
                max={5}
                value={alignByIndex}
                onChange={onChangeAlignByIndex}
                formatValue={formatIncrementerValue}
                disableZero
              />
              <div className={css(styles.alignBySelect)}>
                <Select
                  value={alignByEventType}
                  options={eventTypeOptions.filter(opt => opt.value !== FILTERED_EVENTS)}
                  optionRenderer={valueRenderer}
                  valueRenderer={valueRenderer}
                  onChange={({ value }) => onChangeAlignByEventType(value)}
                />
              </div>
            </div>
          </div>

          <div className={css(styles.flexColumn, styles.padBottom)}>
            <div className={css(styles.title)}>
              Event type summary
              <div className={css(styles.subTitle)}>
                {`${metaData.eventCountTotal} events`}
                {hiddenEventCount > 0 &&
                  ` (${hiddenEventCount} hidden [${hiddenEventPerc.toFixed(1)}%])`}
              </div>
            </div>
            <div className={css(styles.flexColumn)}>
              <EventTypeRadialChart
                data={metaData.eventCountArray}
                width={0.7 * width}
                height={0.7 * width}
                colorScale={legendScale}
              />
              <EventTypeLegend
                scale={legendScale}
                labelFormat={label => {
                  const count = metaData.eventCountLookup[label];
                  const percentage = (count / metaData.eventCountTotal) * 100;
                  const text = label === FILTERED_EVENTS ? 'filtered by alignment' : label;

                  return isNaN(percentage) // eslint-disable-line no-restricted-globals
                    ? text
                    : `${text} (${percentage.toFixed(1)}%)`;
                }}
                onClick={onClickLegendShape}
                hiddenEventTypes={hiddenEventTypes}
              />
            </div>
          </div>

          <div className={css(styles.padBottom)}>
            <StepIncrementer
              min={1}
              max={10}
              value={minEventCount}
              onChange={onChangeMinEventCount}
              formatValue={val => `Hide nodes with < ${val} event${val > 1 ? 's' : ''}`}
            />
          </div>

          <div className={css(styles.padBottom)}>
            <div className={css(styles.title)}>X-axis</div>
            <Select
              value={xScaleType}
              options={[
                { label: 'Elapsed time', value: ELAPSED_TIME_SCALE },
                { label: 'Event sequence', value: EVENT_SEQUENCE_SCALE },
              ]}
              onChange={({ value }) => onChangeXScale(value)}
            />
          </div>

          <div>
            <div className={css(styles.title)}>Sort nodes with the same parent by</div>
            <Select
              value={orderBy}
              options={[
                { label: 'Event count', value: ORDER_BY_EVENT_COUNT },
                { label: 'Time to next event', value: ORDER_BY_ELAPSED_MS },
              ]}
              onChange={({ value }) => onChangeOrderBy(value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

ControlPanel.propTypes = propTypes;
ControlPanel.defaultProps = defaultProps;

export default ControlPanel;
