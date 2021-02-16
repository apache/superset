from jinja2 import Environment, FileSystemLoader
import base64

env = Environment(loader=FileSystemLoader('./templates'))

error_page_template = env.get_template('error_page.html')

# encode images as base64
encoded_images = {}
for filename in ["error404.png", "error500.png", "favicon.png"]:
    with open("images/"+filename, "rb") as image_file:
        encoded_images[filename] = base64.b64encode(image_file.read()).decode("utf-8") 

# render templates
error_page_404 = error_page_template.render(
    favicon_data=encoded_images["favicon.png"],
    title="404: Not found | Superset",
    heading="Page not found",
    body="Sorry, we cannot find the page you are looking for. You may have mistyped the address or the page may have moved.",
    image_data=encoded_images["error404.png"],
)
with open("./generated/404.html", "w") as new_file:
    new_file.write(error_page_404)

error_page_500 = error_page_template.render(
    favicon_data=encoded_images["favicon.png"],
    title="500: Internal server error | Superset",
    heading="Internal server error",
    body="Sorry, something went wrong. We are fixing the mistake now. Try again later or go back to home.",
    image_data=encoded_images["error500.png"],
)
with open("./generated/500.html", "w") as new_file:
    new_file.write(error_page_500)
