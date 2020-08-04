/* eslint-disable react/jsx-no-bind */

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import AutosizeInput from 'react-input-autosize';

import './example.less';

class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			value1: '',
			value2: 'example',
			value3: 3,
			value4: '',
			value5: '',
		};
	}
	updateInputValue = (input, event) => {
		const newState = {};
		newState[input] = event.target.value;
		this.setState(newState);
	};
	render () {
		return (
			<div>
				<h3>Simple example:</h3>
				<AutosizeInput
					autoFocus
					value={this.state.value1}
					onChange={this.updateInputValue.bind(this, 'value1')}
				/>
				<h3>Styled example with default value:</h3>
				<AutosizeInput
					value={this.state.value2}
					onChange={this.updateInputValue.bind(this, 'value2')}
					style={{ background: '#eee', borderRadius: 5, padding: 5 }}
					inputStyle={{ border: '1px solid #999', borderRadius: 3, padding: 3, fontSize: 14 }}
				/>
				<h3>Typed example with default value:</h3>
				<AutosizeInput
					value={this.state.value3}
					type="number"
					onChange={this.updateInputValue.bind(this, 'value3')}
				/>
				<h3>Input with placeholder:</h3>
				<AutosizeInput
					placeholder="Placeholder"
					value={this.state.value4}
					onChange={this.updateInputValue.bind(this, 'value4')}
					style={{ background: '#eee', borderRadius: 5, padding: 5 }}
					inputStyle={{ border: '1px solid #999', borderRadius: 3, padding: 3, fontSize: 14 }}
				/>
				<h3>Input with placeholder as minimum width:</h3>
				<AutosizeInput
					placeholder="Placeholder"
					placeholderIsMinWidth
					value={this.state.value5}
					onChange={this.updateInputValue.bind(this, 'value5')}
					style={{ background: '#eee', borderRadius: 5, padding: 5 }}
					inputStyle={{ border: '1px solid #999', borderRadius: 3, padding: 3, fontSize: 14 }}
				/>
			</div>
		);
	}
};

ReactDOM.render(<App />, document.getElementById('app'));
