# Obtención de tokens via api
Para la obtención de tokens directamente vía api, ir a la dirección http://localhost:8088/swagger/v1 y, ahí, a la sección Security. Para poder acceder usar admin/admin de user/password.
El token que necesita el html es de tipo guest token, y se realiza la petición con un json como sigue:

```json
{
  "resources": [
    {
      "id": "526b0f7a-8a07-40f8-b84c-52249aee8535",
      "type": "dashboard"
    }
  ],
  "rls": [],
  "user": {
    "first_name": "",
    "last_name": "",
    "username": "u1"
  }
}
```
donde "username" se puede cambiar al nombre de usuario que se quiera (mejor que sea único para distintas peticiones) y el "id" se refiere al id que se obtiene en superset en la opción de embeber el dashboard.

¡¡Importante!! Para embeber los dashboards hay que proporcionar los dominios desde los que se puede acceder a ellos dentro de superset. Comprobar, al poner un dominio nuevo, que la conexión se realiza efectivamente antes de realizar más cambios.
La configuración de embebido de un panel en superset se hace en la opción remarcada en la imagen:

![](images/embeber_panel_1.png)
