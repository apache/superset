import React, {Component} from 'react';
import {render} from 'react-dom';
import {sortableContainer, sortableElement} from 'react-sortable-hoc';
import arrayMove from 'array-move';
import Infinite from 'react-infinite';

const SortableItem = sortableElement(({height, value}) => {
  return <li style={{height}}>{value}</li>;
});

const SortableInfiniteList = sortableContainer(({items}) => {
  return (
    <Infinite
      containerHeight={600}
      elementHeight={items.map(({height}) => height)}
    >
      {items.map(({value, height}, index) => (
        <SortableItem
          key={`item-${value}`}
          index={index}
          value={value}
          height={height}
        />
      ))}
    </Infinite>
  );
});

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

  onSortEnd = ({oldIndex, newIndex}) => {
    this.setState(({items}) => ({
      items: arrayMove(items, oldIndex, newIndex),
    }));
  };

  render() {
    const {items} = this.state;

    return <SortableInfiniteList items={items} onSortEnd={this.onSortEnd} />;
  }
}

render(<App />, document.getElementById('root'));
