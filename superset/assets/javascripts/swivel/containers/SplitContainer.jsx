import React from 'react';
import { connect } from 'react-redux';
import { addSplit, configureSplit, removeSplit } from '../actions/querySettingsActions';
import ColumnDropTarget from '../components/ColumnDropTarget';
import SplitTile from '../components/SplitTile';
import ItemTypes from '../ItemTypes';


const mapTileDispatchToProps = dispatch => ({
  configure: (split) => {
    dispatch(configureSplit(split));
  },
  remove: (split) => {
    dispatch(removeSplit(split));
  },
});

const Tile = connect((state, ownProps) => ownProps, mapTileDispatchToProps)(SplitTile);

function children(state) {
  return state.settings.present.query.splits.map((tile, i) => (
    <Tile
      key={i}
      name={tile.name}
      id={tile.id}
      columnType={tile.columnType}
      groupable={tile.groupable}
      granularity={tile.granularity}
      justAdded={tile.justAdded}

      limit={state.settings.present.query.limit}
      orderBy={state.settings.present.query.orderBy}
      orderDesc={state.settings.present.query.orderDesc}
      timeGrains={state.refData.timeGrains}
      selectedMetrics={state.settings.present.query.metrics}
      metrics={state.refData.metrics}
    />
    ),
  );
}

const mapStateToProps = state => ({
  name: 'Group by',
  accepts: [ItemTypes.DIMENSION],
  children: children(state),
});

const mapDispatchToProps = dispatch => ({
  onDrop: (split) => {
    dispatch(addSplit(split));
  },
});


const SplitContainer = connect(
    mapStateToProps,
    mapDispatchToProps,
)(ColumnDropTarget);

export default SplitContainer;
