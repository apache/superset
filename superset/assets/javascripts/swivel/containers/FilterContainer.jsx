import React from 'react';
import { connect } from 'react-redux';
import { addFilter, configureFilter, removeFilter } from '../actions/querySettingsActions';
import ColumnDropTarget from '../components/ColumnDropTarget';
import FilterTile from '../components/FilterTile';
import ContainerTypes from '../ContainerTypes';
import ItemTypes from '../ItemTypes';


const mapTileDispatchToProps = dispatch => ({
  configure: (filter) => {
    dispatch(configureFilter(filter));
  },
  remove: (filter) => {
    dispatch(removeFilter(filter));
  },
});

const Tile = connect((state, ownProps) => ownProps, mapTileDispatchToProps)(FilterTile);

function children(state) {
  return state.settings.present.query.filters.map((tile, i) => (
    <Tile
      key={i}
      name={tile.name}
      id={tile.id}
      columnType={tile.columnType}
      groupable={tile.groupable}
      filter={tile.filter}

      intervalStart={tile.intervalStart}
      intervalEnd={tile.intervalEnd}

      invert={tile.invert}
      like={tile.like}
      leftOpen={tile.leftOpen}
      rightOpen={tile.rightOpen}
      postAggregation={tile.postAggregation}

      datasource={state.settings.present.query.datasource}
    />
    ));
}

const mapStateToProps = state => ({
  name: 'Filters',
  datasource: state.settings.present.query.datasource,
  type: ContainerTypes.FILTER,
  children: children(state),
  accepts: [ItemTypes.DIMENSION],
});

const mapDispatchToProps = dispatch => ({
  onDrop: (filter) => {
    dispatch(addFilter(filter));
  },
});

const FilterContainer = connect(
    mapStateToProps,
    mapDispatchToProps,
)(ColumnDropTarget);

export default FilterContainer;
