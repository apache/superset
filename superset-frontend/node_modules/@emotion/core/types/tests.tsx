/** @jsx jsx */
import { ComponentClass } from 'react'
import {
  ClassNames,
  ClassNamesContent,
  Global,
  Interpolation,
  CacheProvider,
  css,
  jsx,
  keyframes,
  withEmotionCache
} from '@emotion/core'
;<Global styles={[]} />

interface TestTheme0 {
  resetStyle: any
}

;<Global styles={(theme: TestTheme0) => [theme.resetStyle]} />

declare const getRandomColor: () => string

const ComponentWithCache = withEmotionCache((_props: {}, context) => {
  return (
    <div
      onClick={() =>
        context.sheet.insert(`div { backgroundColor: ${getRandomColor()} }`)
      }
    />
  )
})
;<ComponentWithCache ref={() => {}} />
;<div css={{}}>
  <h1
    css={css`
      font-size: 500px;
    `}
  >
    This is really big
  </h1>
  <Global
    styles={{
      body: {
        backgroundColor: 'hotpink'
      }
    }}
  />
</div>
;<Global
  styles={css`
    body {
      background-color: black;
    }
  `}
/>

declare const MyComponent: ComponentClass<{ className?: string; world: string }>
;<MyComponent
  css={{
    backgroundColor: 'black'
  }}
  world="is-gone"
/>

const anim0 = keyframes({
  from: {
    top: 0
  },

  to: {
    top: '20px'
  }
})
;<MyComponent
  css={{
    animationName: anim0
  }}
  world="of-world"
/>

const anim1 = keyframes`
  from: {
    margin-left: 50px;
  }

  to: {
    margin-left: 0;
  }
`
;<MyComponent
  css={{
    animationName: anim1
  }}
  world="of-world"
/>

interface TestTheme1 {
  primaryColor: string
  secondaryColor: string
}

;<ClassNames>
  {({ css, cx, theme }: ClassNamesContent<TestTheme1>) => {
    return (
      <div>
        <span className={cx('a', undefined, 'b', null, [['abc']])} />
        <span
          className={css({
            color: theme.primaryColor
          })}
        >
          Fst Text
        </span>
        <span
          className={css`
            color: theme.secondaryColor;
          `}
        >
          Snd Text
        </span>
      </div>
    )
  }}
</ClassNames>
