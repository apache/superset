import React, {Component} from 'react';
import {render} from 'react-dom';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  arrayMove,
} from 'react-sortable-hoc';

const DragHandle = SortableHandle(() => <span>::</span>); // This can be any component you want

const SortableItem = SortableElement(({value}) => {
  return (
    <li>
      <DragHandle />
      {value}
    </li>
  );
});

const SortableList = SortableContainer(({items}) => {
  return (
    <ul>
      {items.map((value, index) => (
        <SortableItem key={`item-${index}`} index={index} value={value} />
      ))}
    </ul>
  );
});

class SortableComponent extends Component {
  state = {
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'],
  };
  onSortEnd = ({oldIndex, newIndex}) => {
    const {items} = this.state;

    this.setState({
      items: arrayMove(items, oldIndex, newIndex),
    });
  };
  render() {
    const {items} = this.state;

    return <SortableList items={items} onSortEnd={this.onSortEnd} useDragHandle={true} />;
  }
}

render(<SortableComponent />, document.getElementById('root'));
