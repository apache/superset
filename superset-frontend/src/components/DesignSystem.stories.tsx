import AtomicDesign from './atomic-design.png';
import Markdown from 'markdown-to-jsx';

export default {
  title: 'Design System/Introduction',
};

export const DesignSystem = () => (
  <Markdown>
    {`
# Superset Design System

A design system is a complete set of standards intended to manage design at scale using reusable components and patterns.

You can get an overview of Atomic Design concepts and a link to the full book on the topic here:

<a href="https://bradfrost.com/blog/post/atomic-web-design/" target="_blank">
  Intro to Atomic Design
</a>

While the Superset Design System will use Atomic Design principles, we choose a different language to describe the elements.

| Atomic Design   |    Atoms    | Molecules  | Organisms | Templates | Pages / Screens |
| :-------------- | :---------: | :--------: | :-------: | :-------: | :-------------: |
| Superset Design | Foundations | Components | Patterns  | Templates |    Features     |

<img
  src={AtomicDesign}
  alt="Atoms = Foundations, Molecules = Components, Organisms = Patterns, Templates = Templates, Pages / Screens = Features"
/>

    `}
  </Markdown>
)
