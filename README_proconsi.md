# Readme para la instalación de Proconsi

Para que funcione, tras instalar la aplicación deben copiarse en la carpeta superset/static/assets/images los archivos de proconsi-assets/images.

Es posible que también tengas que copiar estas imágenes en superset/superset-frontend/src/assets/images.

En config.py hay un flag que se llama SESSION_COOKIE_SAMESITE, que por defecto está puesto a "Lax". Si no te dejase loguearte la primera vez, cámbialo a None y, después del primer logging, de nuevo a "Lax".
