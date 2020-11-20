function parent_post() {
  parent.postMessage({
    type: "iframeUrl",
    data: window.location.href
  }, "*")
}

window.addEventListener('DOMContentLoaded', parent_post, false)
