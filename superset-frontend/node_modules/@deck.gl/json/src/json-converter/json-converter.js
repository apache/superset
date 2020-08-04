// Converts JSON to props ("hydrating" classes, resolving enums and functions etc).
// TODO - Currently converts in place, might be clearer to convert to separate structure

import {shallowEqualObjects} from '../utils/shallow-equal-objects.js';
import parseJSON from '../parsers/parse-json';
import {convertTopLevelJSON} from '../parsers/convert-json';

export default class JSONConverter {
  constructor(props) {
    this.configuration = {};
    this.onJSONChange = () => {};
    // this._onViewStateChange = this._onViewStateChange.bind(this);
    this.setProps(props);
  }

  finalize() {}

  setProps(props) {
    // HANDLE CONFIGURATION PROPS
    if ('configuration' in props) {
      this.configuration = props.configuration;
    }

    if ('onJSONChange' in props) {
      this.onJSONChange = props.onJSONChange;
    }
  }

  convertJsonToDeckProps(json) {
    // Use shallow equality to Ensure we only convert once
    if (!json || json === this.json) {
      return this.deckProps;
    }
    this.json = json;

    // Accept JSON strings by parsing them
    const parsedJSON = parseJSON(json);

    // Convert the JSON
    const jsonProps = convertTopLevelJSON(parsedJSON, this.configuration);

    // Handle `json.initialViewState`
    // If we receive new JSON we need to decide if we should update current view state
    // Current heuristic is to compare with last `initialViewState` and only update if changed
    if ('initialViewState' in jsonProps) {
      const updateViewState =
        !this.initialViewState ||
        !shallowEqualObjects(jsonProps.initialViewState, this.initialViewState);

      if (updateViewState) {
        jsonProps.viewState = jsonProps.initialViewState;
        this.initialViewState = jsonProps.initialViewState;
      }

      delete jsonProps.initialViewState;
    }

    this.deckProps = jsonProps;
    return jsonProps;
  }
}
