# @vx/gradient

```
npm install --save @vx/gradient
```

Inspired by: https://dribbble.com/shots/3380672-Sketch-Gradients-Freebie

## Example

```js
import { AreaClosed } from '@vx/shape';
import { GradientPinkBlue } from '@vx/gradient';

const GradientArea = () => {
    return (
      <svg>
        <GradientPinkBlue id="gradient" />
        <AreaClosed fill="url('#gradient')" />
      </svg>
    );
}
```

## The Definition Caveat

Like patterns, gradients are "defined." When you put down a `<PinkBlue />`, it's putting a [`<linearGradient/>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient) attribute inside a `<def>` in the SVG.

It's often better to think of these as variable definitions rather than true DOM elements. When you use `fill="url('#gradient')"` you're referencing the gradient's id: `gradient`.


## Premades
vx comes with a couple pre-made gradients for you to use.

|    Gradients Available     |
| -------------------------- |
| `GradientDarkgreenGreen`   |
| `GradientLightgreenGreen`  |
| `GradientOrangeRed`        |
| `GradientPinkBlue`         |
| `GradientPinkRed`          |
| `GradientPurpleOrange`     |
| `GradientPurpleTeal`       |
| `GradientSteelPurple`      |
| `GradientTealBlue`         |


## Make your own!

You can make any linear gradient like so:

```js
import { LinearGradient } from '@vx/gradient';

<LinearGradient
  from='#a18cd1'
  to='#fbc2eb'
/>
```
