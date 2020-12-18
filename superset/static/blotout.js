const parentPost = () => {
  parent.postMessage({
    type: "iframeUrl",
    data: window.location.href,
    handler: 'load'
  }, "*")
}

let modifyTimer
const modifyCheck = (func) => {
  const result = func()
  if (!result) {
    modifyTimer = setInterval(func, 500)
  } else {
    clearInterval(modifyTimer)
  }
}

const modifyElements = () => {
  switch (window.location.pathname) {
    case '/databaseview/list/':
    case '/tablemodelview/list/': {
      // Add + button to source database and table pages
      modifyCheck(() => {
        const elements = document.querySelectorAll('header nav .navbar-right .btn-primary')
        if (elements.length === 0) {
          return false
        }
        elements[0].style.display = 'inline-block'
        return true
      })
      break
    }
    case '/users/userinfo/':
    case '/users/show/': {
      // remove reset password button from user page
      modifyCheck(() => {
        const elements = document.querySelectorAll('.panel-body .well .btn-primary')
        if (elements.length === 0) {
          return false
        }
        elements[0].style.display = 'none'
        return true
     })
    }
  }
}

window.addEventListener('load', parentPost, false)
window.addEventListener('load', modifyElements, false)
