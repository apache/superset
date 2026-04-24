#!/usr/bin/python3
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import re
import subprocess
import sys
from typing import Optional

import requests

# Part 1: Verify SHA512 hash - this is the same as running `shasum -a 512 {release}` and comparing it against `{release}.sha512`  # noqa: E501


def get_sha512_hash(filename: str) -> str:
    """Run the shasum command on the file and return the SHA512 hash."""
    result = subprocess.run(["shasum", "-a", "512", filename], stdout=subprocess.PIPE)  # noqa: S603, S607
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
    """Verify if the SHA512 hash of the file matches with the hash in the .sha512 file."""  # noqa: E501
    sha512_hash = get_sha512_hash(filename)
    sha512_file_content = read_sha512_file(filename)

    if sha512_hash == sha512_file_content:
        return "SHA verified"
    else:
        return "SHA failed"


# Part 2: Verify RSA key - this is the same as running `gpg --verify {release}.asc {release}` and comparing the RSA key and email address against the KEYS file  # noqa: E501


KEYS_URL = "https://downloads.apache.org/superset/KEYS"


def ensure_keys_imported() -> None:
    """Import the Apache Superset KEYS file into the local GPG keyring.

    Without this, `gpg --verify` returns "No public key" and the signature
    cannot actually be verified — only the key ID in the signature metadata
    is visible.
    """
    try:
        keys = requests.get(KEYS_URL, timeout=30)
    except requests.RequestException as exc:
        print(f"Warning: could not fetch KEYS file for import: {exc}")
        return
    if keys.status_code != 200:
        print(f"Warning: could not fetch KEYS file (HTTP {keys.status_code})")
        return
    subprocess.run(  # noqa: S603
        ["gpg", "--import"],  # noqa: S607
        input=keys.content,
        capture_output=True,
    )


def get_gpg_info(filename: str) -> tuple[Optional[str], Optional[str]]:
    """Run the GPG verify command and extract RSA/EDDSA key and email address."""
    asc_filename = filename + ".asc"
    result = subprocess.run(  # noqa: S603
        ["gpg", "--verify", asc_filename, filename],  # noqa: S607
        capture_output=True,  # noqa: S607
    )
    output = result.stderr.decode()

    # If no public key was available, import KEYS and retry so that
    # `Good signature from "Name <email>"` appears in the output.
    if "No public key" in output:
        ensure_keys_imported()
        result = subprocess.run(  # noqa: S603
            ["gpg", "--verify", asc_filename, filename],  # noqa: S607
            capture_output=True,  # noqa: S607
        )
        output = result.stderr.decode()

    # If the signature was not actually verified, do not trust the key ID or
    # email pulled from signature metadata — returning them would let the
    # caller report the release as "verified" when GPG never validated it.
    if result.returncode != 0 or "Good signature" not in output:
        print("Warning: GPG could not verify the signature.")
        if "No public key" in output:
            print(
                "Hint: public key is not in your keyring. Import it with:\n"
                f"  curl -s {KEYS_URL} | gpg --import"
            )
        return None, None

    rsa_key = re.search(r"RSA key ([0-9A-F]+)", output)
    eddsa_key = re.search(r"EDDSA key ([0-9A-F]+)", output)

    # Try multiple patterns — `Good signature from` is the most reliable
    # source of the email; `issuer` is a fallback for older gpg output.
    email_patterns = (
        r'Good signature from ".*?<([^>]+)>"',
        r'aka ".*?<([^>]+)>"',
        r'issuer "([^"]+)"',
    )
    email_result: Optional[str] = None
    for pattern in email_patterns:
        match = re.search(pattern, output)
        if match:
            email_result = match.group(1)
            break

    rsa_key_result = rsa_key.group(1) if rsa_key else None
    eddsa_key_result = eddsa_key.group(1) if eddsa_key else None
    key_result = rsa_key_result or eddsa_key_result

    if key_result:
        print("RSA or EDDSA Key found")
    else:
        print("Warning: No RSA or EDDSA key found in GPG verification output.")
    if email_result:
        print(f"Email found: {email_result}")
    else:
        print("Warning: No email address found in GPG verification output.")

    return key_result, email_result


def verify_key(key: str, email: Optional[str]) -> str:
    """Fetch the KEYS file and verify if the RSA/EDDSA key and email match."""
    url = "https://downloads.apache.org/superset/KEYS"
    response = requests.get(url)  # noqa: S113
    if response.status_code == 200:
        if key not in response.text:
            return "RSA/EDDSA key not found on KEYS page"

        # Check if email is None or not in response.text
        if email and email in response.text:
            return "RSA/EDDSA key and email verified against Apache KEYS file"
        elif email:
            return "RSA/EDDSA key verified, but Email not found on KEYS page"
        else:
            return "RSA/EDDSA key verified, but Email not available for verification"
    else:
        return "Failed to fetch KEYS file"


def verify_sha512_and_rsa(filename: str) -> None:
    """Verify SHA512 hash and RSA key."""
    sha_result = verify_sha512(filename)
    print(sha_result)

    key, email = get_gpg_info(filename)
    if key:
        rsa_result = verify_key(key, email)
        print(rsa_result)
    else:
        print("GPG verification failed: RSA key or email not found")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <filename>")
    else:
        filename = sys.argv[1]
        verify_sha512_and_rsa(filename)
