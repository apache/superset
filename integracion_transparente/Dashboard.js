import axios from 'axios';
import { embedDashboard } from "@superset-ui/embedded-sdk";

const supersetUrl = 'http://localhost:8088'
const supersetApiUrl = supersetUrl + '/api/v1/security'
const dashboardId = "526b0f7a-8a07-40f8-b84c-52249aee8535" // replace with your dashboard id



export async function getToken() {
  // This uses admin creds to fetch the token
  const login_body = {
    "password": "admin",
    "provider": "db",
    "refresh": true,
    "username": "admin"
  };
  const login_headers = {
    "headers": {
      "Content-Type": "application/json"
    }
  }


  const { data } = await axios.post(supersetApiUrl + '/login', login_body, login_headers)
  const access_token = data['access_token']
  console.log(access_token)


  // Calling guest token
  const guest_token_body = JSON.stringify({
    "resources": [
      {
        "type": "dashboard",
        "id": dashboardId,
      }
    ],
    "rls": [],
    "user": {
      "username": "",
      "first_name": "",
      "last_name": "",
    }
  });

  const guest_token_headers = {
    "headers": {
      "Content-Type": "application/json",
      "Authorization": 'Bearer ' + access_token
    }
  }


  // Calling guest token endpoint to get the guest_token
  await axios.post(supersetApiUrl + '/guest_token/', guest_token_body, guest_token_headers).then(dt => {
    console.log(dt.data['token'])
    embedDashboard({
      id: dashboardId,  // Use the id obtained from enabling embedding dashboard option
      supersetDomain: supersetUrl,
      mountPoint: document.getElementById("superset-container"), // html element in which iframe will be mounted to show the dashboard
      fetchGuestToken: () => dt.data['token'],
      dashboardUiConfig: { 
        // hideTitle: true,
        // hideTab:true
        filters:{
          expanded:true
        },
        urlParams:{
          standalone:3 // here you can add the url_params and there values
        }
      }
    });
  })

  var iframe = document.querySelector("iframe")
  if (iframe) {
    iframe.style.width = '100%'; // Set the width of the iframe
    iframe.style.minHeight = '100vw'; // Set the height of the iframe
  }

}
