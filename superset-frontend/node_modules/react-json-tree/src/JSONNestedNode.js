import React from 'react';
import PropTypes from 'prop-types';
import JSONArrow from './JSONArrow';
import getCollectionEntries from './getCollectionEntries';
import JSONNode from './JSONNode';
import ItemRange from './ItemRange';

/**
 * Renders nested values (eg. objects, arrays, lists, etc.)
 */

function renderChildNodes(props, from, to) {
  const {
    nodeType,
    data,
    collectionLimit,
    circularCache,
    keyPath,
    postprocessValue,
    sortObjectKeys
  } = props;
  const childNodes = [];

  getCollectionEntries(
    nodeType,
    data,
    sortObjectKeys,
    collectionLimit,
    from,
    to
  ).forEach(entry => {
    if (entry.to) {
      childNodes.push(
        <ItemRange
          {...props}
          key={`ItemRange--${entry.from}-${entry.to}`}
          from={entry.from}
          to={entry.to}
          renderChildNodes={renderChildNodes}
        />
      );
    } else {
      const { key, value } = entry;
      const isCircular = circularCache.indexOf(value) !== -1;

      const node = (
        <JSONNode
          {...props}
          {...{ postprocessValue, collectionLimit }}
          key={`Node--${key}`}
          keyPath={[key, ...keyPath]}
          value={postprocessValue(value)}
          circularCache={[...circularCache, value]}
          isCircular={isCircular}
          hideRoot={false}
        />
      );

      if (node !== false) {
        childNodes.push(node);
      }
    }
  });

  return childNodes;
}

function getStateFromProps(props) {
  // calculate individual node expansion if necessary
  const expanded =
    props.shouldExpandNode && !props.isCircular
      ? props.shouldExpandNode(props.keyPath, props.data, props.level)
      : false;
  return {
    expanded
  };
}

export default class JSONNestedNode extends React.Component {
  static propTypes = {
    getItemString: PropTypes.func.isRequired,
    nodeTypeIndicator: PropTypes.any,
    nodeType: PropTypes.string.isRequired,
    data: PropTypes.any,
    hideRoot: PropTypes.bool.isRequired,
    createItemString: PropTypes.func.isRequired,
    styling: PropTypes.func.isRequired,
    collectionLimit: PropTypes.number,
    keyPath: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    ).isRequired,
    labelRenderer: PropTypes.func.isRequired,
    shouldExpandNode: PropTypes.func,
    level: PropTypes.number.isRequired,
    sortObjectKeys: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    isCircular: PropTypes.bool,
    expandable: PropTypes.bool
  };

  static defaultProps = {
    data: [],
    circularCache: [],
    level: 0,
    expandable: true
  };

  constructor(props) {
    super(props);
    this.state = getStateFromProps(props);
  }

  componentWillReceiveProps(nextProps) {
    const nextState = getStateFromProps(nextProps);
    if (getStateFromProps(this.props).expanded !== nextState.expanded) {
      this.setState(nextState);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !!Object.keys(nextProps).find(
        key =>
          key !== 'circularCache' &&
          (key === 'keyPath'
            ? nextProps[key].join('/') !== this.props[key].join('/')
            : nextProps[key] !== this.props[key])
      ) || nextState.expanded !== this.state.expanded
    );
  }

  render() {
    const {
      getItemString,
      nodeTypeIndicator,
      nodeType,
      data,
      hideRoot,
      createItemString,
      styling,
      collectionLimit,
      keyPath,
      labelRenderer,
      expandable
    } = this.props;
    const { expanded } = this.state;
    const renderedChildren =
      expanded || (hideRoot && this.props.level === 0)
        ? renderChildNodes({ ...this.props, level: this.props.level + 1 })
        : null;

    const itemType = (
      <span {...styling('nestedNodeItemType', expanded)}>
        {nodeTypeIndicator}
      </span>
    );
    const renderedItemString = getItemString(
      nodeType,
      data,
      itemType,
      createItemString(data, collectionLimit)
    );
    const stylingArgs = [keyPath, nodeType, expanded, expandable];

    return hideRoot ? (
      <li {...styling('rootNode', ...stylingArgs)}>
        <ul {...styling('rootNodeChildren', ...stylingArgs)}>
          {renderedChildren}
        </ul>
      </li>
    ) : (
      <li {...styling('nestedNode', ...stylingArgs)}>
        {expandable && (
          <JSONArrow
            styling={styling}
            nodeType={nodeType}
            expanded={expanded}
            onClick={this.handleClick}
          />
        )}
        <label
          {...styling(['label', 'nestedNodeLabel'], ...stylingArgs)}
          onClick={this.handleClick}
        >
          {labelRenderer(...stylingArgs)}
        </label>
        <span
          {...styling('nestedNodeItemString', ...stylingArgs)}
          onClick={this.handleClick}
        >
          {renderedItemString}
        </span>
        <ul {...styling('nestedNodeChildren', ...stylingArgs)}>
          {renderedChildren}
        </ul>
      </li>
    );
  }

  handleClick = () => {
    if (this.props.expandable) {
      this.setState({ expanded: !this.state.expanded });
    }
  };
}
