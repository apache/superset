const parentPost = () => {
  parent.postMessage({
    type: 'ss-iframe',
    data: {
      url: window.location.href,
      session: getCookie('session')
    },
    handler: 'load'
  }, '*')
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

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  if (match && match.length > 2) {
    return match[2]
  }

  return ''
}

const login = () => {
  if (window.location.pathname !== '/login/') {
    return
  }

  const query = new URLSearchParams(window.location.search)
  if (!query.get('token')) {
    parent.postMessage({
      type: 'ss-expired'
    }, '*')
    return
  }

  let data = null
  try {
    data = JSON.parse(document.querySelector('body').innerText)
    data.session = getCookie('session')
  } catch (e) {
    console.error(e)
  }

  parent.postMessage({
    type: 'ss-login',
    data,
  }, '*')
}

const load = () => {
  parentPost()
  modifyElements()
  login()
}

window.addEventListener('load', load, false)
