/* @flow */
import React from 'react';
import { StyleSheet, css } from '../../src/index.js';

const StyleTester = React.createClass({
    getInitialState: function() {
        return {
            timer: true,
        };
    },

    componentDidMount: function() {
        const flipTimer = () => {
            this.setState({
                timer: !this.state.timer,
            });
            setTimeout(flipTimer, 1000);
        };

        setTimeout(flipTimer, 1000);
    },

    render: function() {
        const testCases = [
            <span className={css(styles.red)}>This should be red</span>,
            <span className={css(styles.hover)}>This should turn red on hover</span>,
            <span className={css(styles.small)}>This should turn red when the browser is less than 600px width</span>,
            <span className={css(styles.red, styles.blue)}>This should be blue</span>,
            <span className={css(styles.blue, styles.red)}>This should be red</span>,
            <span className={css(styles.hover, styles.blue)}>This should be blue but turn red on hover</span>,
            <span className={css(styles.small, styles.blue)}>This should be blue but turn red when less than 600px width</span>,
            <span className={css(styles.hover, styles.hoverBlue)}>This should turn blue on hover</span>,
            <span className={css(styles.small, styles.evenSmaller)}>This should turn red when less than 600px and blue when less than 400px</span>,
            <span className={css(styles.smallAndHover)}>This should be red when small, green when hovered, and blue when both.</span>,
            <span className={css(styles.smallAndHover, styles.returnOfSmallAndHover)}>This should be blue when small, red when hovered, and green when both.</span>,
            <span className={css(styles.red, styles2.red)}>This should be green.</span>,
            <span className={css(this.state.timer ? styles.red : styles.blue)}>This should alternate between red and blue every second.</span>,
            <a href='javascript: void 0' className={css(styles.pseudoSelectors)}>This should turn red on hover and ???? (blue or red) on active</a>,
            <div className={css(styles.flexCenter)}><div className={css(styles.flexInner)}>This should be centered inside the outer box, even in IE 10.</div></div>,
            <span className={css(styles.singleAnimation)}>This should animate from side to side</span>,
            <span className={css(styles.doubleAnimation)}>This should animate from side to side, as well as fade in</span>,
        ];

        return <div>
            {testCases.map((testCase, i) => <div key={i}>{testCase}</div>)}
        </div>;
    },
});


const translateKeyframes = {
    '0%': {
        transform: 'translateX(0)',
    },

    '50%': {
        transform: 'translateX(100px)',
    },

    '100%': {
        transform: 'translateX(0)',
    },
};

const opacityKeyframes = {
    'from': {
        opacity: 0,
    },

    'to': {
        opacity: 1,
    }
};

const styles = StyleSheet.create({
    red: {
        color: "red",
    },

    blue: {
        color: "blue",
    },

    hover: {
        ":hover": {
            color: "red",
        }
    },

    hoverBlue: {
        ":hover": {
            color: "blue",
        }
    },

    small: {
        "@media (max-width: 600px)": {
            color: "red",
        }
    },

    evenSmaller: {
        "@media (max-width: 400px)": {
            color: "blue",
        }
    },

    smallAndHover: {
        "@media (max-width: 600px)": {
            color: "red",
            ":hover": {
                color: "blue",
            }
        },
        ":hover": {
            color: "green",
        }
    },

    returnOfSmallAndHover: {
        "@media (max-width: 600px)": {
            color: "blue",
            ":hover": {
                color: "green",
            }
        },
        ":hover": {
            color: "red",
        }
    },

    pseudoSelectors: {
        ":hover": {
            color: "red",
        },
        ":active": {
            color: "blue",
        }
    },

    flexCenter: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: 200,
        height: 200,
        outline: "1px solid black",
    },

    flexInner: {
        display: "inline-block",
        width: 100,
        textAlign: "justify",
        textAlignLast: "justify",
    },

    singleAnimation: {
        display: 'inline-block',
        animationName: translateKeyframes,
        animationDuration: '3s',
        animationIterationCount: 'infinite',
    },

    doubleAnimation: {
        display: 'inline-block',
        animationName: [translateKeyframes, opacityKeyframes],
        animationDuration: '3s, 1200ms',
        animationIterationCount: 'infinite',
    },
});

const styles2 = StyleSheet.create({
    red: {
        color: "green",
    },
});

export default StyleTester;
