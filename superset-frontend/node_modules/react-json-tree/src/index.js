// ES6 + inline style port of JSONViewer https://bitbucket.org/davevedder/react-json-viewer/
// all credits and original code to the author
// Dave Vedder <veddermatic@gmail.com> http://www.eskimospy.com/
// port by Daniele Zannotti http://www.github.com/dzannotti <dzannotti@me.com>

import React from 'react';
import PropTypes from 'prop-types';
import JSONNode from './JSONNode';
import createStylingFromTheme from './createStylingFromTheme';
import { invertTheme } from 'react-base16-styling';

const identity = value => value;
const expandRootNode = (keyName, data, level) => level === 0;
const defaultItemString = (type, data, itemType, itemString) => (
  <span>
    {itemType} {itemString}
  </span>
);
const defaultLabelRenderer = ([label]) => <span>{label}:</span>;
const noCustomNode = () => false;

function checkLegacyTheming(theme, props) {
  const deprecatedStylingMethodsMap = {
    getArrowStyle: 'arrow',
    getListStyle: 'nestedNodeChildren',
    getItemStringStyle: 'nestedNodeItemString',
    getLabelStyle: 'label',
    getValueStyle: 'valueText'
  };

  const deprecatedStylingMethods = Object.keys(
    deprecatedStylingMethodsMap
  ).filter(name => props[name]);

  if (deprecatedStylingMethods.length > 0) {
    if (typeof theme === 'string') {
      theme = {
        extend: theme
      };
    } else {
      theme = { ...theme };
    }

    deprecatedStylingMethods.forEach(name => {
      // eslint-disable-next-line no-console
      console.error(
        `Styling method "${name}" is deprecated, use "theme" property instead`
      );

      theme[deprecatedStylingMethodsMap[name]] = ({ style }, ...args) => ({
        style: {
          ...style,
          ...props[name](...args)
        }
      });
    });
  }

  return theme;
}

function getStateFromProps(props) {
  let theme = checkLegacyTheming(props.theme, props);
  if (props.invertTheme) {
    if (typeof theme === 'string') {
      theme = `${theme}:inverted`;
    } else if (theme && theme.extend) {
      if (typeof theme === 'string') {
        theme = { ...theme, extend: `${theme.extend}:inverted` };
      } else {
        theme = { ...theme, extend: invertTheme(theme.extend) };
      }
    } else if (theme) {
      theme = invertTheme(theme);
    }
  }
  return {
    styling: createStylingFromTheme(theme)
  };
}

export default class JSONTree extends React.Component {
  static propTypes = {
    data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
    hideRoot: PropTypes.bool,
    theme: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    invertTheme: PropTypes.bool,
    keyPath: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    ),
    postprocessValue: PropTypes.func,
    sortObjectKeys: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
  };

  static defaultProps = {
    shouldExpandNode: expandRootNode,
    hideRoot: false,
    keyPath: ['root'],
    getItemString: defaultItemString,
    labelRenderer: defaultLabelRenderer,
    valueRenderer: identity,
    postprocessValue: identity,
    isCustomNode: noCustomNode,
    collectionLimit: 50,
    invertTheme: true
  };

  constructor(props) {
    super(props);
    this.state = getStateFromProps(props);
  }

  componentWillReceiveProps(nextProps) {
    if (['theme', 'invertTheme'].find(k => nextProps[k] !== this.props[k])) {
      this.setState(getStateFromProps(nextProps));
    }
  }

  shouldComponentUpdate(nextProps) {
    return !!Object.keys(nextProps).find(
      k =>
        k === 'keyPath'
          ? nextProps[k].join('/') !== this.props[k].join('/')
          : nextProps[k] !== this.props[k]
    );
  }

  render() {
    const {
      data: value,
      keyPath,
      postprocessValue,
      hideRoot,
      theme, // eslint-disable-line no-unused-vars
      invertTheme: _, // eslint-disable-line no-unused-vars
      ...rest
    } = this.props;

    const { styling } = this.state;

    return (
      <ul {...styling('tree')}>
        <JSONNode
          {...{ postprocessValue, hideRoot, styling, ...rest }}
          keyPath={hideRoot ? [] : keyPath}
          value={postprocessValue(value)}
        />
      </ul>
    );
  }
}
