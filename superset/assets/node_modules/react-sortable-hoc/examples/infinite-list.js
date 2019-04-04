import React, {Component} from 'react';
import {render} from 'react-dom';
import {SortableContainer, SortableElement, arrayMove} from 'react-sortable-hoc';
import Infinite from 'react-infinite';

const SortableItem = SortableElement(({height, value}) => {
  return (
    <li style={{height}}>
      {value}
    </li>
  );
});

const SortableList = SortableContainer(({items}) => {
  return (
    <Infinite containerHeight={600} elementHeight={items.map(({height}) => height)}>
      {items.map(({value, height}, index) => (
        <SortableItem key={`item-${index}`} index={index} value={value} height={height} />
      ))}
    </Infinite>
  );
});

class SortableComponent extends Component {
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
    const {items} = this.state;

    this.setState({
      items: arrayMove(items, oldIndex, newIndex),
    });
  };
  render() {
    const {items} = this.state;

    return <SortableList items={items} onSortEnd={this.onSortEnd} />;
  }
}

render(<SortableComponent />, document.getElementById('root'));
