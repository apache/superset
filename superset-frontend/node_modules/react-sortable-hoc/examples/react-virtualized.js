import React, {Component} from 'react';
import {render} from 'react-dom';
import {sortableContainer, sortableElement} from 'react-sortable-hoc';
import arrayMove from 'array-move';
import {List} from 'react-virtualized';

const SortableItem = sortableElement(({value}) => {
  return <li>{value}</li>;
});

class VirtualList extends Component {
  renderRow = ({index}) => {
    const {items} = this.props;
    const {value} = items[index];

    return <SortableItem index={index} value={value} />;
  };

  getRowHeight = ({index}) => {
    const {items} = this.props;
    return items[index].height;
  };

  render() {
    const {items, getRef} = this.props;

    return (
      <List
        ref={getRef}
        rowHeight={this.getRowHeight}
        rowRenderer={this.renderRow}
        rowCount={items.length}
        width={400}
        height={600}
      />
    );
  }
}

const SortableVirtualList = sortableContainer(VirtualList);

class App extends Component {
  state = {
    items: [
      {value: 'Item 1', height: 89},
      {value: 'Item 2', height: 59},
      {value: 'Item 3', height: 130},
      {value: 'Item 4', height: 59},
      {value: 'Item 5', height: 200},
      {value: 'Item 6', height: 150},
    ],
  };

  registerListRef = (listInstance) => {
    this.List = listInstance;
  };

  onSortEnd = ({oldIndex, newIndex}) => {
    if (oldIndex === newIndex) {
      return;
    }

    const {items} = this.state;

    this.setState({
      items: arrayMove(items, oldIndex, newIndex),
    });

    // We need to inform React Virtualized that the items have changed heights
    // This can either be done by imperatively calling the recomputeRowHeights and
    // forceUpdate instance methods on the `List` ref, or by passing an additional prop
    // to List that changes whenever the order changes to force it to re-render
    this.List.recomputeRowHeights();
    this.List.forceUpdate();
  };

  render() {
    const {items} = this.state;

    return (
      <SortableVirtualList
        getRef={this.registerListRef}
        items={items}
        onSortEnd={this.onSortEnd}
      />
    );
  }
}

render(<App />, document.getElementById('root'));
