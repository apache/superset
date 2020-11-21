function parentPost() {
  parent.postMessage({
    type: "iframeUrl",
    data: window.location.href,
    handler: 'load'
  }, "*")
}

const modifyElements = () => {
  // Add + button to source database and table pages
  if (window.location.pathname === '/databaseview/list/' ||
      window.location.pathname === '/tablemodelview/list/') {
    document.querySelectorAll('header nav .navbar-right')[1].style.display = 'block'
  }

  // remove reset password button from user page
  if (window.location.pathname === '/users/userinfo/' ||
      window.location.pathname.startsWith('/users/show/')) {
    document.querySelector('.panel-body .well .btn-primary').style.display = 'none'
  }
}

window.addEventListener('load', parentPost, false)
window.addEventListener('load', modifyElements, false)
