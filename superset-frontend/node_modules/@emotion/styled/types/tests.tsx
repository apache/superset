import styled, { CreateStyled } from '@emotion/styled'

// $ExpectType CreateStyledComponentIntrinsic<"a", {}, any>
styled.a
// $ExpectType CreateStyledComponentIntrinsic<"body", {}, any>
styled.body
// $ExpectType CreateStyledComponentIntrinsic<"div", {}, any>
styled.div
// $ExpectType CreateStyledComponentIntrinsic<"svg", {}, any>
styled.svg

{
  // $ExpectType CreateStyledComponentIntrinsic<"svg", { bar: string }, { themed: "black" }>
  styled.div<{ bar: string }, { themed: 'black' }>`
    color: ${props => {
      // $ExpectType { themed: "black" }
      const { theme } = props
      return theme.themed
    }};
  `
}

{
  const myStyled: CreateStyled<{ themed: 'black' }> = styled
  // $ExpectError - created styled shouldn't allow for parametrizing with Theme type
  myStyled.div<{ bar: string }, { themed: 'orange' }>``

  myStyled.div<{ bar: string }>`
    color: ${props => {
      // $ExpectType { themed: "black" }
      const { theme } = props
      return theme.themed
    }};
  `
}
