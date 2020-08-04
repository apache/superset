Enzyme
=======

[![Join the chat at https://gitter.im/airbnb/enzyme](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/airbnb/enzyme?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![npm Version](https://img.shields.io/npm/v/enzyme.svg)](https://www.npmjs.com/package/enzyme) [![License](https://img.shields.io/npm/l/enzyme.svg)](https://www.npmjs.com/package/enzyme) [![Build Status](https://travis-ci.org/airbnb/enzyme.svg)](https://travis-ci.org/airbnb/enzyme) [![Coverage Status](https://coveralls.io/repos/airbnb/enzyme/badge.svg?branch=master&service=github)](https://coveralls.io/github/airbnb/enzyme?branch=master)


Enzyme is a JavaScript Testing utility for React that makes it easier to test your React Components' output.
You can also manipulate, traverse, and in some ways simulate runtime given the output.

Enzyme's API is meant to be intuitive and flexible by mimicking jQuery's API for DOM manipulation
and traversal.

Upgrading from Enzyme 2.x or React < 16
===========

Are you here to check whether or not Enzyme is compatible with React 16? Are you currently using
Enzyme 2.x? Great! Check out our [migration guide](/docs/guides/migration-from-2-to-3.md) for help
moving on to Enzyme v3 where React 16 is supported.

### [Installation](/docs/installation/README.md)

To get started with enzyme, you can simply install it via npm. You will need to install enzyme
along with an Adapter corresponding to the version of react (or other UI Component library) you
are using. For instance, if you are using enzyme with React 16, you can run:

```bash
npm i --save-dev enzyme enzyme-adapter-react-16
```

Each adapter may have additional peer dependencies which you will need to install as well. For instance,
`enzyme-adapter-react-16` has peer dependencies on `react` and `react-dom`.

At the moment, Enzyme has adapters that provide compatibility with `React 16.x`, `React 15.x`,
`React 0.14.x` and `React 0.13.x`.

The following adapters are officially provided by enzyme, and have the following compatibility with
React:

| Enzyme Adapter Package | React semver compatibility |
| --- | --- |
| `enzyme-adapter-react-16` | `^16.4.0-0` |
| `enzyme-adapter-react-16.3` | `~16.3.0-0` |
| `enzyme-adapter-react-16.2` | `~16.2` |
| `enzyme-adapter-react-16.1` | `~16.0.0-0 \|\| ~16.1` |
| `enzyme-adapter-react-15` | `^15.5.0` |
| `enzyme-adapter-react-15.4` | `15.0.0-0 - 15.4.x` |
| `enzyme-adapter-react-14` | `^0.14.0` |
| `enzyme-adapter-react-13` | `^0.13.0` |

Finally, you need to configure enzyme to use the adapter you want it to use. To do this, you can use
the top level `configure(...)` API.

```js
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });
```

3rd Party Adapters
=============

It is possible for the community to create additional (non-official) adapters that will make enzyme
work with other libraries. If you have made one and it's not included in the list below, feel free
to make a PR to this README and add a link to it! The known 3rd party adapters are:

| Adapter Package | For Library | Status |
| --- | --- | --- |
| [`enzyme-adapter-preact-pure`](https://github.com/preactjs/enzyme-adapter-preact-pure) | [`preact`](https://github.com/developit/preact) | (stable) |
|[`enzyme-adapter-inferno`](https://github.com/bbc/enzyme-adapter-inferno)|[`inferno`](https://github.com/infernojs/inferno)|(work in progress)|

Running Enzyme Tests
===========

Enzyme is unopinionated regarding which test runner or assertion library you use, and should be
compatible with all major test runners and assertion libraries out there. The documentation and
examples for enzyme use [mocha](https://mochajs.org/) and [chai](http://chaijs.com/), but you
should be able to extrapolate to your framework of choice.

If you are interested in using enzyme with custom assertions and convenience functions for
testing your React components, you can consider using:

* [`chai-enzyme`](https://github.com/producthunt/chai-enzyme) with Mocha/Chai.
* [`jasmine-enzyme`](https://github.com/FormidableLabs/enzyme-matchers/tree/master/packages/jasmine-enzyme) with Jasmine.
* [`jest-enzyme`](https://github.com/FormidableLabs/enzyme-matchers/tree/master/packages/jest-enzyme) with Jest.
* [`should-enzyme`](https://github.com/rkotze/should-enzyme) for should.js.
* [`expect-enzyme`](https://github.com/PsychoLlama/expect-enzyme) for expect.


[Using Enzyme with Mocha](/docs/guides/mocha.md)

[Using Enzyme with Karma](/docs/guides/karma.md)

[Using Enzyme with Browserify](/docs/guides/browserify.md)

[Using Enzyme with SystemJS](/docs/guides/systemjs.md)

[Using Enzyme with Webpack](/docs/guides/webpack.md)

[Using Enzyme with JSDOM](/docs/guides/jsdom.md)

[Using Enzyme with React Native](/docs/guides/react-native.md)

[Using Enzyme with Jest](/docs/guides/jest.md)

[Using Enzyme with Lab](/docs/guides/lab.md)

[Using Enzyme with Tape and AVA](/docs/guides/tape-ava.md)

Basic Usage
===========

## [Shallow Rendering](/docs/api/shallow.md)

```javascript
import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import MyComponent from './MyComponent';
import Foo from './Foo';

describe('<MyComponent />', () => {
  it('renders three <Foo /> components', () => {
    const wrapper = shallow(<MyComponent />);
    expect(wrapper.find(Foo)).to.have.lengthOf(3);
  });

  it('renders an `.icon-star`', () => {
    const wrapper = shallow(<MyComponent />);
    expect(wrapper.find('.icon-star')).to.have.lengthOf(1);
  });

  it('renders children when passed in', () => {
    const wrapper = shallow((
      <MyComponent>
        <div className="unique" />
      </MyComponent>
    ));
    expect(wrapper.contains(<div className="unique" />)).to.equal(true);
  });

  it('simulates click events', () => {
    const onButtonClick = sinon.spy();
    const wrapper = shallow(<Foo onButtonClick={onButtonClick} />);
    wrapper.find('button').simulate('click');
    expect(onButtonClick).to.have.property('callCount', 1);
  });
});
```

Read the full [API Documentation](/docs/api/shallow.md)



## [Full DOM Rendering](/docs/api/mount.md)

```javascript
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { mount } from 'enzyme';

import Foo from './Foo';

describe('<Foo />', () => {
  it('allows us to set props', () => {
    const wrapper = mount(<Foo bar="baz" />);
    expect(wrapper.props().bar).to.equal('baz');
    wrapper.setProps({ bar: 'foo' });
    expect(wrapper.props().bar).to.equal('foo');
  });

  it('simulates click events', () => {
    const onButtonClick = sinon.spy();
    const wrapper = mount((
      <Foo onButtonClick={onButtonClick} />
    ));
    wrapper.find('button').simulate('click');
    expect(onButtonClick).to.have.property('callCount', 1);
  });

  it('calls componentDidMount', () => {
    sinon.spy(Foo.prototype, 'componentDidMount');
    const wrapper = mount(<Foo />);
    expect(Foo.prototype.componentDidMount).to.have.property('callCount', 1);
    Foo.prototype.componentDidMount.restore();
  });
});
```

Read the full [API Documentation](/docs/api/mount.md)


## [Static Rendered Markup](/docs/api/render.md)

```javascript
import React from 'react';
import { expect } from 'chai';
import { render } from 'enzyme';

import Foo from './Foo';

describe('<Foo />', () => {
  it('renders three `.foo-bar`s', () => {
    const wrapper = render(<Foo />);
    expect(wrapper.find('.foo-bar')).to.have.lengthOf(3);
  });

  it('renders the title', () => {
    const wrapper = render(<Foo title="unique" />);
    expect(wrapper.text()).to.contain('unique');
  });
});
```

Read the full [API Documentation](/docs/api/render.md)


### Future

[Enzyme Future](/docs/future.md)


### Contributing

See the [Contributors Guide](/CONTRIBUTING.md)

### In the wild

Organizations and projects using `enzyme` can list themselves [here](INTHEWILD.md).

### License

[MIT](/LICENSE.md)
