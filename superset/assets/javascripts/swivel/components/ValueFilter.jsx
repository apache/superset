import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Checkbox, Label } from 'react-bootstrap';
import { AsyncCreatable } from 'react-select';

const PAGE_SIZE = 1000;  // Max num records to be fetched per request
const DEBOUNCE_MS = 400;  // Time to wait for more input between key strokes
const FILTER_REQUEST_TIMEOUT = 30000;  // 30 seconds

const propTypes = {
  id: PropTypes.string.isRequired,
  datasource: PropTypes.string,
  filter: PropTypes.array,
  invert: PropTypes.bool,
  like: PropTypes.bool,
  onChange: PropTypes.func,
};

/**
 * The ValueFilter loads options for auto complete incrementally and asynchronously
 * while typing. It is debounced to prevent making new request for each key stroke,
 * thus it will wait for DEBOUNCE_MS before making a request.
 * Requests will be canceled if the result is not needed anymore.
 * It also supports pipe delimited pasting of multiple values.
 * */
class ValueFilter extends PureComponent {
  constructor(props) {
    super(props);
    this.loadOptions = this.loadOptions.bind(this);
    this.handlePaste = this.handlePaste.bind(this);
    this.state = {
      // These caches are used for the auto complete filter
      cache: {},
      completeCache: {},
      currentSearchString: '',
      optionsDebounce: {},
      optionsRequest: {},
    };
  }

  componentWillUnmount() {
    // Cancel requests that are still running
    if (this.state.optionsRequest.abort) {
      this.state.optionsRequest.abort();
    }
  }

  // This will handle pasting pipe delimited data into the filter select
  handlePaste(e) {
    e.preventDefault();
    const pastedValues = e.clipboardData.getData('Text').split('|');
    this.props.onChange({ filter: [...this.props.filter, ...pastedValues] });
  }

  handleFilter(e) {
    return { filter: e.map(f => f.value) };
  }

  loadOptions(searchString) {
    // Debounce request
    if (searchString && this.state.currentSearchString !== searchString) {
      return {};
    }
    // Cancel requests that are still running
    if (this.state.optionsRequest.abort) {
      this.state.optionsRequest.abort();
    }

    const { datasource, id } = this.props;
    const completeCache = this.state.completeCache;

    const cacheKeyBase = `${datasource}@${id}@`;
    const [dsId, dsType] = datasource.split('__');
    const url = `/superset/filter/${dsType}/${dsId}/${id}/${PAGE_SIZE}/${searchString}`;
    for (let i = 0; i <= searchString.length; i++) {
      const options = completeCache[`${cacheKeyBase}${searchString.substring(0, i)}`];
      if (options) {
        return Promise.resolve({ options });
      }
    }
    const queryRequest = $.ajax({
      url,
      dataType: 'json',
      timeout: FILTER_REQUEST_TIMEOUT,
    });
    this.setState({ optionsRequest: queryRequest });
    return queryRequest.then((json) => {
      const options = json.map(x => ({ value: x, label: x }));
      if (json.length < PAGE_SIZE) {
        this.setState({
          completeCache: Object.assign(completeCache, {
            [`${cacheKeyBase}${searchString}`]: options,
          }),
        });
      } else {
        this.setState({
          cache: Object.assign(this.state.cache, {
            [`${cacheKeyBase}${searchString}`]: options,
          }),
        });
      }
      return {
        options,
        complete: json.length < PAGE_SIZE,
      };
    });
  }

  render() {
    const { filter, invert, like, onChange } = this.props;
    return (
      <div style={{ marginBottom: '2rem' }}>
        <Label>Filter</Label>
        <AsyncCreatable
          name="filter"
          autosize
          multi
          autoload
          openAfterFocus
          ignoreCase
          openOnFocus
          cache={this.state.cache}
          inputProps={{ onPaste: this.handlePaste }}
          value={filter.map(f => ({ label: f, value: f }))}
          onChange={e => onChange(this.handleFilter(e))}
          loadOptions={
                str => (new Promise(resolve => this.setState(
                      { currentSearchString: str }, resolve)))
                    .then(() => new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS)))
                    .then(() => this.loadOptions(str))
              }
          promptTextCreator={s => s}
        />
        <Checkbox
          checked={invert}
          onChange={() => onChange({ invert: !invert })}
        >Invert</Checkbox>
        {
            filter.length <= 1 &&
            <Checkbox
              checked={like}
              onChange={() => onChange({ like: !like })}
            >Like/Regex</Checkbox>
          }
        <div className="clearfix" />
      </div>
    );
  }
}

ValueFilter.propTypes = propTypes;
export default ValueFilter;
