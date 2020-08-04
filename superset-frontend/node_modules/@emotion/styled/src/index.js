// @flow
import styled from '@emotion/styled-base'
import { tags } from './tags'

// bind it to avoid mutating the original function
const newStyled = styled.bind()

tags.forEach(tagName => {
  newStyled[tagName] = newStyled(tagName)
})

export default newStyled
