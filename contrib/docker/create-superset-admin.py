import subprocess
import helpers

if __name__ == '__main__':
    secret = helpers.get_secret(secret_name="superset_admin_credentials", region_name="us-west-2")
    username = secret['username']
    password = secret['password']
    email = secret['email']

    admin_command = [
        "flask", "fab", "create-admin", f"--username={username}", "--firstname=Superset", "--lastname=Admin",
        f"--password={password}", f"--email={email}"]
    subprocess.call(admin_command)

