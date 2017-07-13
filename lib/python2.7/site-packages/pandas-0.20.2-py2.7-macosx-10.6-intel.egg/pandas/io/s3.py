""" s3 support for remote file interactivity """
from pandas import compat
try:
    import s3fs
    from botocore.exceptions import NoCredentialsError
except:
    raise ImportError("The s3fs library is required to handle s3 files")

if compat.PY3:
    from urllib.parse import urlparse as parse_url
else:
    from urlparse import urlparse as parse_url


def _strip_schema(url):
    """Returns the url without the s3:// part"""
    result = parse_url(url)
    return result.netloc + result.path


def get_filepath_or_buffer(filepath_or_buffer, encoding=None,
                           compression=None):
    fs = s3fs.S3FileSystem(anon=False)
    try:
        filepath_or_buffer = fs.open(_strip_schema(filepath_or_buffer))
    except (OSError, NoCredentialsError):
        # boto3 has troubles when trying to access a public file
        # when credentialed...
        # An OSError is raised if you have credentials, but they
        # aren't valid for that bucket.
        # A NoCredentialsError is raised if you don't have creds
        # for that bucket.
        fs = s3fs.S3FileSystem(anon=True)
        filepath_or_buffer = fs.open(_strip_schema(filepath_or_buffer))
    return filepath_or_buffer, None, compression
