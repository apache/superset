import subprocess
from contrib.docker import helpers


if __name__ == '__main__':
    the_secrets_provider = helpers.get_env_variable("SECRETS_PROVIDER")
    admin_secret = helpers.get_env_variable("SUPERSET_ADMIN_USER_SECRET")

    secret = helpers.get_secret(secrets_provider=the_secrets_provider, secret_key=admin_secret)
    username = secret['username']
    password = secret['password']
    email = secret['email']

    admin_command = [
        "flask", "fab", "create-admin", f"--username={username}", "--firstname=Superset", "--lastname=Admin",
        f"--password={password}", f"--email={email}"]
    subprocess.call(admin_command)

