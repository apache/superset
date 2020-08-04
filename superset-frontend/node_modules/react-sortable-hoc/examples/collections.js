import React, {Component} from 'react';
import {render} from 'react-dom';
import {sortableContainer, sortableElement} from 'react-sortable-hoc';
import arrayMove from 'array-move';

const SortableItem = sortableElement(({value}) => <li>{value}</li>);

const SortableContainer = sortableContainer(({children}) => {
  return <div>{children}</div>;
});

class App extends Component {
  state = {
    collections: [[0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2]],
  };

  onSortEnd = ({oldIndex, newIndex, collection}) => {
    this.setState(({collections}) => {
      const newCollections = [...collections];

      newCollections[collection] = arrayMove(
        collections[collection],
        oldIndex,
        newIndex,
      );

      return {collections: newCollections};
    });
  };

  render() {
    const {collections} = this.state;

    return (
      <SortableContainer onSortEnd={this.onSortEnd}>
        {collections.map((items, index) => (
          <React.Fragment key={index}>
            <strong>LIST {index}</strong>
            <ul>
              {items.map((item, i) => (
                <SortableItem
                  key={item}
                  value={`Item ${item}`}
                  index={i}
                  collection={index}
                />
              ))}
            </ul>
          </React.Fragment>
        ))}
      </SortableContainer>
    );
  }
}

render(<App />, document.getElementById('root'));
