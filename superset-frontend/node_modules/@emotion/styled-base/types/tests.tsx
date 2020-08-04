import * as React from 'react'
import styled from '@emotion/styled-base'

// tslint:disable-next-line: interface-over-type-literal
type ReactClassProps0 = {
  readonly column: boolean
}
declare class ReactClassComponent0 extends React.Component<ReactClassProps0> {}

interface ReactClassProps1 {
  readonly value: string
}
declare class ReactClassComponent1 extends React.Component<ReactClassProps1> {}

interface ReactClassProps2 {
  readonly column: number
}
declare class ReactClassComponent2 extends React.Component<ReactClassProps2> {}

// tslint:disable-next-line: interface-over-type-literal
type ReactSFCProps0 = {
  readonly column: boolean
}
declare const ReactSFC0: React.SFC<ReactSFCProps0>

interface ReactSFCProps1 {
  readonly value: string
}
declare const ReactSFC1: React.SFC<ReactSFCProps1>

interface ReactSFCProps2 {
  readonly value: number
}
declare const ReactSFC2: React.SFC<ReactSFCProps2>

const Button0 = styled('button')`
  color: blue;
`
const Button1 = styled('button')({
  color: 'blue'
})
;<div>
  <Button0 />
  <Button0 type="button" />
</div>
;<div>
  <Button1 />
  <Button1 type="button" />
</div>

const Input0 = styled('input', {
  label: 'mystyle'
})`
  padding: 4px;
`
const Input1 = styled('input', {
  label: 'mystyle'
})({
  padding: '4px'
})
;<Input0 />
;<Input1 />
const Input2 = Button0.withComponent('input')

const Canvas0 = styled('canvas', {
  shouldForwardProp(propName) {
    return propName === 'width' || propName === 'height'
  }
})`
  width: 200px;
`
const Canvas1 = styled('canvas', {
  shouldForwardProp(propName) {
    return propName === 'width' || propName === 'height'
  }
})({
  width: '200px'
})
;<Canvas0 />
;<Canvas1 />

interface PrimaryProps {
  readonly primary: string
}
/**
 * @desc
 * This function accepts `InnerProps`/`Tag` to infer the type of `tag`,
 * and accepts `ExtraProps` for user who use string style
 * to be able to declare extra props without using
 * `` styled('button')<ExtraProps>`...` ``, which does not supported in
 * styled-component VSCode extension.
 * If your tool support syntax highlighting for `` styled('button')<ExtraProps>`...` ``
 * it could be more efficient.
 */
const Button2 = styled<'button', PrimaryProps>('button')`
  fontsize: ${5}px;
  color: ${props => props.primary};
`
const Button3 = styled<'button', PrimaryProps>('button')(props => ({
  color: props.primary
}))
;<div>
  <Button2 primary="blue" />
  <Button2 primary="blue" type="button" />
</div>
;<div>
  <Button3 primary="blue" />
  <Button3 primary="blue" type="button" />
</div>
// $ExpectError
;<Button2 />
// $ExpectError
;<Button2 type="button" />
// $ExpectError
;<Button3 />
// $ExpectError
;<Button3 type="button" />

const Button4 = styled<typeof ReactClassComponent0, PrimaryProps>(
  ReactClassComponent0
)`
  backgroundColor: ${props => props.theme.backColor}

  fontSize: ${5}px;
  color: ${props => props.primary}
`
const Button5 = styled<typeof ReactSFC0, PrimaryProps>(ReactSFC0)(props => ({
  color: props.primary
}))
;<div>
  <Button4 column={true} primary="blue" />
  <Button4 column={false} primary="blue" />
</div>
;<div>
  <Button5 column={true} primary="blue" />
  <Button5 column={false} primary="blue" />
</div>
// $ExpectError
;<Button4 />
// $ExpectError
;<Button4 colume={true} />
// $ExpectError
;<Button5 />
// $ExpectError
;<Button5 colume={true} />

const Container0 = styled(ReactClassComponent0)`
  display: flex;
  flexdirection: ${props => props.column && 'column'};
`
;<Container0 column={false} />
// $ExpectError
;<Container0 />

const Container1 = Container0.withComponent('span')
;<Container1 column={true} />
;<Container1 column={true} onClick={undefined as any} />
// $ExpectError
;<Container1 contentEditable />

const Container2 = Container0.withComponent(ReactSFC0)
;<Container2 column={true} />
// $ExpectError
;<Container2 />

const Container3 = Container0.withComponent(ReactClassComponent1)
;<Container3 column={false} value="123" />
// $ExpectError
;<Container3 colume={true} />
// $ExpectError
;<Container3 value="5" />

interface ContainerProps {
  extraWidth: string
}
const Container4 = styled(ReactSFC2)<ContainerProps>(props => ({
  borderColor: 'black',
  borderWidth: props.extraWidth,
  borderStyle: 'solid'
}))
;<Container4 extraWidth="20px" value={123} />
// $ExpectError
;<Container4 />
// $ExpectError
;<Container4 value="5" />

const Container5 = Container3.withComponent(ReactSFC2)
;<Container5 column={true} value={123} />
// $ExpectError
;<Container5 />
// $ExpectError
;<Container5 column={true} />
// $ExpectError
;<Container5 value={242} />

// $ExpectError
styled(ReactSFC2)<ReactSFCProps1>()

/**
 * @todo
 * I wish we could raise errors for following two `withComponent`s.
 */
Container0.withComponent(ReactClassComponent2)
Container3.withComponent(ReactClassComponent2)

const StyledClass0 = styled(ReactClassComponent0)({})
declare const ref0_0: (element: ReactClassComponent0 | null) => void
declare const ref0_1: (element: ReactClassComponent1 | null) => void
declare const ref0_2: (element: HTMLDivElement | null) => void
;<StyledClass0 column={true} ref={ref0_0} />
// $ExpectError
;<StyledClass0 column={true} ref={ref0_1} />
// $ExpectError
;<StyledClass0 column={true} ref={ref0_2} />

const StyledClass1 = StyledClass0.withComponent(ReactClassComponent1)
declare const ref1_0: (element: ReactClassComponent1 | null) => void
declare const ref1_1: (element: ReactClassComponent0 | null) => void
declare const ref1_2: (element: HTMLDivElement | null) => void
;<StyledClass1 column={true} value="" ref={ref1_0} />
// $ExpectError
;<StyledClass1 column={true} value="" ref={ref1_1} />
// $ExpectError
;<StyledClass1 column={true} value="" ref={ref1_2} />

const StyledClass2 = StyledClass0.withComponent('div')
declare const ref2_0: (element: HTMLDivElement | null) => void
declare const ref2_1: (element: ReactClassComponent0 | null) => void
declare const ref2_2: (element: ReactClassComponent1 | null) => void
;<StyledClass2 column={true} ref={ref2_0} />
// $ExpectError
;<StyledClass2 column={true} ref={ref2_1} />
// $ExpectError
;<StyledClass2 column={true} ref={ref2_2} />

const StyledClass3 = StyledClass1.withComponent('label')
declare const ref3_0: (element: HTMLLabelElement | null) => void
declare const ref3_1: (element: ReactClassComponent0 | null) => void
declare const ref3_2: (element: HTMLDivElement | null) => void
;<StyledClass3 column={true} ref={ref3_0} />
// $ExpectError
;<StyledClass3 column={true} ref={ref3_1} />
// $ExpectError
;<StyledClass3 column={true} ref={ref3_2} />

{
  interface Book {
    kind: 'book'
    author: string
  }

  interface Magazine {
    kind: 'magazine'
    issue: number
  }

  type SomethingToRead = Book | Magazine

  const Readable: React.SFC<SomethingToRead> = props => {
    if (props.kind === 'magazine') {
      return <div>magazine #{props.issue}</div>
    }

    return <div>magazine #{props.author}</div>
  }

  const StyledReadable = styled(Readable)`
    font-size: ${props => (props.kind === 'book' ? 16 : 14)};
  `
  ;<Readable kind="book" author="Hejlsberg" />
  ;<StyledReadable kind="book" author="Hejlsberg" />
  ;<Readable kind="magazine" author="Hejlsberg" /> // $ExpectError
  ;<StyledReadable kind="magazine" author="Hejlsberg" /> // $ExpectError
}

interface Props {
  prop: boolean
}
class ClassWithDefaultProps extends React.Component<Props> {
  static defaultProps = { prop: false }
  render() {
    return this.props.prop ? <Button0 /> : <Button1 />
  }
}
const StyledClassWithDefaultProps = styled(ClassWithDefaultProps)`
  background-color: red;
`
const classInstance = <StyledClassWithDefaultProps />

const FCWithDefaultProps = ({ prop }: Props) =>
  prop ? <Button0 /> : <Button1 />
FCWithDefaultProps.defaultProps = {
  prop: false
}
const StyledFCWithDefaultProps = styled(FCWithDefaultProps)`
  background-color: red;
`
const fcInstance = <StyledFCWithDefaultProps />
