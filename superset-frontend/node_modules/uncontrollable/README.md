# uncontrollable

Wrap a controlled react component, to allow specific prop/handler pairs to be omitted by Component consumers. Uncontrollable allows you to write React components, with minimal state, and then wrap them in a component that will manage state for prop/handlers if they are excluded.

## Install

```sh
npm i -S uncontrollable
```

### Usage

If you are a bit unsure on the _why_ of this module read the next section first. If you just want to see some real-world examples, check out [React Widgets](https://github.com/jquense/react-widgets) which makes [heavy use of this strategy](https://github.com/jquense/react-widgets/blob/5d1b530cb094cdc72f577fe01abe4a02dd265400/src/Multiselect.jsx#L521).

```js
import { uncontrollable } from 'uncontrollable'
```

### API

#### `uncontrollable(Component, propHandlerHash, [methods])`

- `Component`: is a valid react component, such as the result of `createClass`
- `propHandlerHash`: define the pairs of prop/handlers you want to be uncontrollable, e.g. `{ value: 'onChange'}`
- `methods`: since uncontrollable wraps your component in another component, methods are not immediately accessible. You can proxy them through by providing the names of the methods you want to continue to expose. **You don't need this if you are using React >= v16.3.0, the ref will automatically be forwarded to the uinderlying component**

For every prop you indicate as uncontrollable, the returned component will also accept an initial, `default` value for that prop. For example, `open` can be left uncontrolled but the initial value can be set via `defaultOpen={true}` if we want it to start open.

```js
import { uncontrollable } from 'uncontrollable'

const UncontrolledCombobox = uncontrollable(Combobox, {
  value: 'onChange',
  open: 'onToggle',
  searchTerm: 'onSearch', //the current typed value (maybe it filters the dropdown list)
})
```

Since uncontrollable creates a new component that wraps your existing one, methods on your underlying component
won't be immediately accessible. In general this sort of access is not idiomatic React, but it does have its place.
The third argument of `uncontrollable()` is an optional array of method names you want uncontrollable to "pass through"
to the original component.

```js
let UncontrolledForm = uncontrollable(Form, { value: 'onChange' }, ['submit'])

//when you use a ref this will work
this.refs.myForm.submit()
```

#### `useUncontrolled(props, propsHandlerHash) => controlledProps`

A React hook that can be used in place of the above Higher order Component. It
returns a complete set of `props` which are safe to spread through to a child element.

```js
import { useUncontrolled } from 'uncontrollable'

const UncontrolledCombobox = props => {
  // filters out defaultValue, defaultOpen and returns controlled
  // versions of onChange, and onToggle.
  const controlledProps = useUncontrolled(props, {
    value: 'onChange',
    open: 'onToggle',
  })

  return <Checkbox {...controlledProps} />
}
```

### Use Case

One of the strengths of React is its extensibility model, enabled by a common practice of pushing component state as high up the tree as possible. While great for enabling extremely flexible and easy to reason about components, this can produce a lot of boilerplate to wire components up with every use. For simple components (like an input) this is usually a matter of tying the input `value` prop to a parent state property via its `onChange` handler. Here is an extremely common pattern:

```jsx
  render() {
    return (
      <input type='text'
        value={this.state.value}
        onChange={ e => this.setState({ value: e.target.value })}
      />
    )
  }
```

This pattern moves the responsibility of managing the `value` from the input to its parent and mimics "two-way" databinding. Sometimes, however, there is no need for the parent to manage the input's state directly. In that case, all we want to do is set the initial `value` of the input and let the input manage it from then on. React deals with this through "uncontrolled" inputs, where if you don't indicate that you want to control the state of the input externally via a `value` prop it will just do the book-keeping for you.

This is a great pattern which we can make use of in our own Components. It is often best to build each component to be as stateless as possible, assuming that the parent will want to control everything that makes sense. Take a simple Dropdown component as an example

```js
class SimpleDropdown extends React.Component {
  static propTypes = {
    value: React.PropTypes.string,
    onChange: React.PropTypes.func,
    open: React.PropTypes.bool,
    onToggle: React.PropTypes.func,
  }

  render() {
    return (
      <div>
        <input
          value={this.props.value}
          onChange={e => this.props.onChange(e.target.value)}
        />
        <button onClick={e => this.props.onToggle(!this.props.open)}>
          open
        </button>
        {this.props.open && (
          <ul className="open">
            <li>option 1</li>
            <li>option 2</li>
          </ul>
        )}
      </div>
    )
  }
}
```

Notice how we don't track any state in our simple dropdown? This is great because a consumer of our module will have the all the flexibility to decide what the behavior of the dropdown should be. Also notice our public API (propTypes), it consists of common pattern: a property we want set (`value`, `open`), and a set of handlers that indicate _when_ we want them set (`onChange`, `onToggle`). It is up to the parent component to change the `value` and `open` props in response to the handlers.

While this pattern offers an excellent amount of flexibility to consumers, it also requires them to write a bunch of boilerplate code that probably won't change much from use to use. In all likelihood they will always want to set `open` in response to `onToggle`, and only in rare cases will want to override that behavior. This is where the controlled/uncontrolled pattern comes in.

We want to just handle the open/onToggle case ourselves if the consumer doesn't provide a `open` prop (indicating that they want to control it). Rather than complicating our dropdown component with all that logic, obscuring the business logic of our dropdown, we can add it later, by taking our dropdown and wrapping it inside another component that handles that for us.

`uncontrollable` allows you separate out the logic necessary to create controlled/uncontrolled inputs letting you focus on creating a completely controlled input and wrapping it later. This tends to be a lot simpler to reason about as well.

```js
  import { uncontrollable } from 'uncontrollable';

  const UncontrollableDropdown = uncontrollable(SimpleDropdown, {
    value: 'onChange',
    open: 'onToggle'
  })

  <UncontrollableDropdown
    value={this.state.val} // we can still control these props if we want
    onChange={val => this.setState({ val })}
    defaultOpen={true} /> // or just let the UncontrollableDropdown handle it
                          // and we just set an initial value (or leave it out completely)!
```

Now we don't need to worry about the open onToggle! The returned component will track `open` for us by assuming that it should just set `open` to whatever `onToggle` returns. If we _do_ want to worry about it we can just provide `open` and `onToggle` props and the uncontrolled input will just pass them through.

The above is a contrived example but it allows you to wrap even more complex Components, giving you a lot of flexibility in the API you can offer a consumer of your Component. For every pair of prop/handlers you also get a defaultProp of the form "default[PropName]" so `value` -> `defaultValue`, and `open` -> `defaultOpen`, etc. [React Widgets](https://github.com/jquense/react-widgets) makes heavy use of this strategy, you can see it in action here: https://github.com/jquense/react-widgets/blob/5d1b530cb094cdc72f577fe01abe4a02dd265400/src/Multiselect.jsx#L521
