import re
import subprocess
import sys
from typing import Optional

import requests

# Part 1: Verify SHA512 hash - this is the same as running `shasum -a 512 {release}` and comparing it against `{release}.sha512`


def get_sha512_hash(filename: str) -> str:
    """Run the shasum command on the file and return the SHA512 hash."""
    result = subprocess.run(["shasum", "-a", "512", filename], stdout=subprocess.PIPE)
    sha512_hash = result.stdout.decode().split()[0]
    return sha512_hash


def read_sha512_file(filename: str) -> str:
    """Read the corresponding .sha512 file and process its contents."""
    sha_filename = filename + ".sha512"
    with open(sha_filename) as file:
        lines = file.readlines()
        processed_sha = "".join(lines[1:]).replace(" ", "").replace("\n", "").lower()
    return processed_sha


def verify_sha512(filename: str) -> str:
    """Verify if the SHA512 hash of the file matches with the hash in the .sha512 file."""
    sha512_hash = get_sha512_hash(filename)
    sha512_file_content = read_sha512_file(filename)

    if sha512_hash == sha512_file_content:
        return "SHA verified"
    else:
        return "SHA failed"


# Part 2: Verify RSA key - this is the same as running `gpg --verify {release}.asc {release}` and comparing the RSA key and email address against the KEYS file


def get_gpg_info(filename: str) -> tuple[Optional[str], Optional[str]]:
    """Run the GPG verify command and extract RSA key and email address."""
    asc_filename = filename + ".asc"
    result = subprocess.run(
        ["gpg", "--verify", asc_filename, filename], capture_output=True
    )
    output = result.stderr.decode()

    rsa_key = re.search(r"RSA key ([0-9A-F]+)", output)
    email = re.search(r'issuer "([^"]+)"', output)

    rsa_key_result = rsa_key.group(1) if rsa_key else None
    email_result = email.group(1) if email else None

    # Debugging: print warnings if rsa_key or email is not found
    if rsa_key_result is None:
        print("Warning: No RSA key found in GPG verification output.")
    if email_result is None:
        print("Warning: No email address found in GPG verification output.")

    return rsa_key_result, email_result


def verify_rsa_key(rsa_key: str, email: Optional[str]) -> str:
    """Fetch the KEYS file and verify if the RSA key and email match."""
    url = "https://downloads.apache.org/superset/KEYS"
    response = requests.get(url)
    if response.status_code == 200:
        if rsa_key not in response.text:
            return "RSA key not found on KEYS page"

        # Check if email is None or not in response.text
        if email and email in response.text:
            return "RSA key and email verified against Apache KEYS file"
        elif email:
            return "RSA key verified, but Email not found on KEYS page"
        else:
            return "RSA key verified, but Email not available for verification"
    else:
        return "Failed to fetch KEYS file"


def verify_sha512_and_rsa(filename: str) -> None:
    """Verify SHA512 hash and RSA key."""
    sha_result = verify_sha512(filename)
    print(sha_result)

    rsa_key, email = get_gpg_info(filename)
    if rsa_key:
        rsa_result = verify_rsa_key(rsa_key, email)
        print(rsa_result)
    else:
        print("GPG verification failed: RSA key or email not found")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <filename>")
    else:
        filename = sys.argv[1]
        verify_sha512_and_rsa(filename)
