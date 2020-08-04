# @emotion/styled

> The styled API for @emotion/core

## Install

```bash
yarn add @emotion/core @emotion/styled
```

## Usage

```jsx
import styled from '@emotion/styled'

let SomeComp = styled.div({
  color: 'hotpink'
})

let AnotherComp = styled.div`
  color: ${props => props.color};
`

render(
  <SomeComp>
    <AnotherComp color="green" />
  </SomeComp>
)
```

More documentation is available at https://emotion.sh/docs/styled.
