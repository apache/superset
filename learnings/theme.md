# Theme Support

## Header

### Steps

* Add Company logo at  `./superset/assets/images/guavus_logo.svg`
* Update new logo path for `APP_ICON` in `./config.py`
* Update Navbar Template at  `./superset/templates/appbuilder/navbar.html`
* Define custom less at `./superset/assets/stylesheets/guavus.less`
* Include  `guavus.less` in `./superset/assets/stylesheets/superset.less`

## Footer

### Steps-

* Define  `TIMEZONE` and `COPYRIGHT`  vars in  `./config.py` to display in Footer
* Define Footer Template  `./superset/templates/appbuilder/footer.html`
* Include `Footer Template` in `./superset/templates/appbuilder/baselayout.html` and `./superset/templates/superset/basic.html` at  `footer` tag

## Note

* Logo, divider line and footer changes are incode these cannot be modify via configuration on runtime. It will be re-code on demand.

## CSS Template support in Superset

### Creating a CSS template

1. Login to Superset with an account that has admin privileges
1. Go to Manage. Then CSS Templates. This will take you to a page showing all the available templates.
1. Create a new CSS template by clicking the + icon in the top right.
1. Specify the Template Name and Css. Click Save.

### Applying a CSS template

How it works in Superset is you manually apply the templates to dashboards. So with that in mind ...

1. Go to the dashboard whose CSS you'd like to change

1. Click Edit Dashboard. It should be available in the top right. If you can't see the Edit Dashboard button then that means you don't have the required privileges to make any changes to the dashboard.

1. Click the Actions dropdown button and go all the way down to Edit CSS. This will allow you to access all the templates that you'd created previously in step 1. Select the template you want. During the selection process, the CSS will be applied automatically and you can get a preview of how it's going to look.

1. Once you have selected a template. Go back to the Actions dropdown button but this time click Save to save your changes.

That's all there is to it!
