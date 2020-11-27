import { styled } from '@superset-ui/core';

type FadeProps = { hovered: boolean };

const Fade = styled.div<FadeProps>`
    transition: all ${({ theme }) => theme.transitionTiming}s;
    opacity: ${props => props.hovered ? 1 : 0};
`

export default Fade;