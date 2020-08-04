// Aphrodite server-side rendering example

// Make a component that generates some styles and returns some HTML.
function render() {
    const {StyleSheet, css} = require("aphrodite/no-important");

    // Make some styles
    const styles = StyleSheet.create({
        red: {
            color: "red",

            ":hover": {
                color: "blue",
            },
        },
    });

    // Generate some CSS with Aphrodite class names in it.
    return `<div class=${css(styles.red)}>
        Hover, and I'll turn blue!
    </div>`;
}

const {StyleSheetServer} = require("aphrodite");

// Call our render function inside of StyleSheetServer.renderStatic
const {css, html} = StyleSheetServer.renderStatic(() => {
    return render();
});

// Observe our output HTML and the Aphrodite-generated CSS
console.log("Output HTML:", html);
console.log("Output CSS:", css.content);
