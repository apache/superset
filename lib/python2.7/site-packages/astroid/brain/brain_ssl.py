# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Astroid hooks for the ssl library."""

from astroid import MANAGER, register_module_extender
from astroid.builder import AstroidBuilder
from astroid import nodes
from astroid import parse


def ssl_transform():
    return parse('''
    from _ssl import OPENSSL_VERSION_NUMBER, OPENSSL_VERSION_INFO, OPENSSL_VERSION
    from _ssl import _SSLContext, MemoryBIO
    from _ssl import (
        SSLError, SSLZeroReturnError, SSLWantReadError, SSLWantWriteError,
        SSLSyscallError, SSLEOFError,
        )
    from _ssl import CERT_NONE, CERT_OPTIONAL, CERT_REQUIRED
    from _ssl import txt2obj as _txt2obj, nid2obj as _nid2obj
    from _ssl import RAND_status, RAND_add, RAND_bytes, RAND_pseudo_bytes
    try:
        from _ssl import RAND_egd
    except ImportError:
        # LibreSSL does not provide RAND_egd
        pass
    from _ssl import (OP_ALL, OP_CIPHER_SERVER_PREFERENCE,
                      OP_NO_COMPRESSION, OP_NO_SSLv2, OP_NO_SSLv3,
                      OP_NO_TLSv1, OP_NO_TLSv1_1, OP_NO_TLSv1_2,
                      OP_SINGLE_DH_USE, OP_SINGLE_ECDH_USE)

    from _ssl import (ALERT_DESCRIPTION_ACCESS_DENIED, ALERT_DESCRIPTION_BAD_CERTIFICATE,
                      ALERT_DESCRIPTION_BAD_CERTIFICATE_HASH_VALUE,
                      ALERT_DESCRIPTION_BAD_CERTIFICATE_STATUS_RESPONSE,
                      ALERT_DESCRIPTION_BAD_RECORD_MAC,
                      ALERT_DESCRIPTION_CERTIFICATE_EXPIRED,
                      ALERT_DESCRIPTION_CERTIFICATE_REVOKED,
                      ALERT_DESCRIPTION_CERTIFICATE_UNKNOWN,
                      ALERT_DESCRIPTION_CERTIFICATE_UNOBTAINABLE,
                      ALERT_DESCRIPTION_CLOSE_NOTIFY, ALERT_DESCRIPTION_DECODE_ERROR,
                      ALERT_DESCRIPTION_DECOMPRESSION_FAILURE,
                      ALERT_DESCRIPTION_DECRYPT_ERROR,
                      ALERT_DESCRIPTION_HANDSHAKE_FAILURE,
                      ALERT_DESCRIPTION_ILLEGAL_PARAMETER,
                      ALERT_DESCRIPTION_INSUFFICIENT_SECURITY,
                      ALERT_DESCRIPTION_INTERNAL_ERROR,
                      ALERT_DESCRIPTION_NO_RENEGOTIATION,
                      ALERT_DESCRIPTION_PROTOCOL_VERSION,
                      ALERT_DESCRIPTION_RECORD_OVERFLOW,
                      ALERT_DESCRIPTION_UNEXPECTED_MESSAGE,
                      ALERT_DESCRIPTION_UNKNOWN_CA,
                      ALERT_DESCRIPTION_UNKNOWN_PSK_IDENTITY,
                      ALERT_DESCRIPTION_UNRECOGNIZED_NAME,
                      ALERT_DESCRIPTION_UNSUPPORTED_CERTIFICATE,
                      ALERT_DESCRIPTION_UNSUPPORTED_EXTENSION,
                      ALERT_DESCRIPTION_USER_CANCELLED)
    from _ssl import (SSL_ERROR_EOF, SSL_ERROR_INVALID_ERROR_CODE, SSL_ERROR_SSL,
                      SSL_ERROR_SYSCALL, SSL_ERROR_WANT_CONNECT, SSL_ERROR_WANT_READ,
                      SSL_ERROR_WANT_WRITE, SSL_ERROR_WANT_X509_LOOKUP, SSL_ERROR_ZERO_RETURN)
    from _ssl import VERIFY_CRL_CHECK_CHAIN, VERIFY_CRL_CHECK_LEAF, VERIFY_DEFAULT, VERIFY_X509_STRICT
    from _ssl import HAS_SNI, HAS_ECDH, HAS_NPN, HAS_ALPN
    from _ssl import _OPENSSL_API_VERSION
    from _ssl import PROTOCOL_SSLv23, PROTOCOL_TLSv1, PROTOCOL_TLSv1_1, PROTOCOL_TLSv1_2
    ''')


register_module_extender(MANAGER, 'ssl', ssl_transform)
