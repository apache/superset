function iframe_resize(){
    parent.postMessage(window.location.href, "*");
}

// assign onload handler 
if ( window.addEventListener ) {
    window.addEventListener('load', iframe_resize, false);
} else if ( window.attachEvent ) { // ie8
    window.attachEvent('onload', iframe_resize);
}
