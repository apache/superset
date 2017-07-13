/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/

#include <stdint.h>
#include <string>
#include <sasl/sasl.h>
#include <sstream>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <iostream>

using namespace std;

namespace saslwrapper {

    class ClientImpl {
    public:
        ClientImpl() : conn(0), cbIndex(0), maxBufSize(65535), minSsf(0), maxSsf(65535), externalSsf(0), secret(0) {}
        ~ClientImpl() { if (conn) sasl_dispose(&conn); conn = 0; }

        /**
         * Set attributes to be used in authenticating the session.  All attributes should be set
         * before init() is called.
         *
         * @param key Name of attribute being set
         * @param value Value of attribute being set
         * @return true iff success.  If false is returned, call getError() for error details.
         *
         * Available attribute keys:
         *
         *    service      - Name of the service being accessed
         *    username     - User identity for authentication
         *    authname     - User identity for authorization (if different from username)
         *    password     - Password associated with username
         *    host         - Fully qualified domain name of the server host
         *    maxbufsize   - Maximum receive buffer size for the security layer
         *    minssf       - Minimum acceptable security strength factor (integer)
         *    maxssf       - Maximum acceptable security strength factor (integer)
         *    externalssf  - Security strength factor supplied by external mechanism (i.e. SSL/TLS)
         *    externaluser - Authentication ID (of client) as established by external mechanism
         */
        bool setAttr(const string& key, const string& value);
        bool setAttr(const string& key, uint32_t value);
        
        /**
         * Initialize the client object.  This should be called after all of the properties have been set.
         *
         * @return true iff success.  If false is returned, call getError() for error details.
         */
        bool init();

        /**
         * Start the SASL exchange with the server.
         *
         * @param mechList List of mechanisms provided by the server
         * @param chosen The mechanism chosen by the client
         * @param initialResponse Initial block of data to send to the server
         *
         * @return true iff success.  If false is returned, call getError() for error details.
         */
        bool start(const string& mechList, string& chosen, string& initialResponse);
        
        /**
         * Step the SASL handshake.
         *
         * @param challenge The challenge supplied by the server
         * @param response (output) The response to be sent back to the server
         *
         * @return true iff success.  If false is returned, call getError() for error details.
         */
        bool step(const string& challenge, string& response);

        /**
         * Encode data for secure transmission to the server.
         *
         * @param clearText Clear text data to be encrypted
         * @param cipherText (output) Encrypted data to be transmitted
         *
         * @return true iff success.  If false is returned, call getError() for error details.
         */
        bool encode(const string& clearText, string& cipherText);

        /**
         * Decode data received from the server.
         *
         * @param cipherText Encrypted data received from the server
         * @param clearText (output) Decrypted clear text data 
         *
         * @return true iff success.  If false is returned, call getError() for error details.
         */
        bool decode(const string& cipherText, string& clearText);

        /**
         * Get the user identity (used for authentication) associated with this session.
         * Note that this is particularly useful for single-sign-on mechanisms in which the 
         * username is not supplied by the application.
         *
         * @param userId (output) Authenticated user ID for this session.
         */
        bool getUserId(string& userId);

        /**
         * Get the security strength factor associated with this session.
         *
         * @param ssf (output) Negotiated SSF value.
         */
        bool getSSF(int *ssf);

        /**
         * Get error message for last error.
         * This function will return the last error message then clear the error state.
         * If there was no error or the error state has been cleared, this function will output
         * an empty string.
         *
         * @param error Error message string
         */        
        void getError(string& error);

    private:
        // Declare private copy constructor and assignment operator.  Ensure that this
        // class is non-copyable.
        ClientImpl(const ClientImpl&);
        const ClientImpl& operator=(const ClientImpl&);

        void addCallback(unsigned long id, void* proc);
        void lastCallback() { addCallback(SASL_CB_LIST_END, 0); }
        void setError(const string& context, int code, const string& text = "", const string& text2 = "");
        void interact(sasl_interact_t* prompt);

        static int cbName(void *context, int id, const char **result, unsigned *len);
        static int cbPassword(sasl_conn_t *conn, void *context, int id, sasl_secret_t **psecret);

        static bool initialized;
        sasl_conn_t* conn;
        sasl_callback_t callbacks[8];
        int cbIndex;
        string error;
        string serviceName;
        string userName;
        string authName;
        string password;
        string hostName;
        string externalUserName;
        uint32_t maxBufSize;
        uint32_t minSsf;
        uint32_t maxSsf;
        uint32_t externalSsf;
        sasl_secret_t* secret;
    };
}

using namespace saslwrapper;

bool ClientImpl::initialized = false;

bool ClientImpl::init()
{
    int result;

    if (!initialized) {
        initialized = true;
        result = sasl_client_init(0);
        if (result != SASL_OK) {
            setError("sasl_client_init", result, sasl_errstring(result, 0, 0));
            return false;
        }
    }


    addCallback(SASL_CB_GETREALM, 0);
    if (!userName.empty()) {
        addCallback(SASL_CB_USER, (void*) cbName);
        addCallback(SASL_CB_AUTHNAME, (void*) cbName);

        if (!password.empty())
            addCallback(SASL_CB_PASS, (void*) cbPassword);
        else
            addCallback(SASL_CB_PASS, 0);
    }
    lastCallback();

    unsigned flags;

    flags = 0;
    if (!authName.empty() && authName != userName)
        flags |= SASL_NEED_PROXY;

    result = sasl_client_new(serviceName.c_str(), hostName.c_str(), 0, 0, callbacks, flags, &conn);
    if (result != SASL_OK) {
        setError("sasl_client_new", result, sasl_errstring(result, 0, 0));
        return false;
    }

    sasl_security_properties_t secprops;

    secprops.min_ssf = minSsf;
    secprops.max_ssf = maxSsf;
    secprops.maxbufsize = maxBufSize;
    secprops.property_names = 0;
    secprops.property_values = 0;
    secprops.security_flags = 0;

    result = sasl_setprop(conn, SASL_SEC_PROPS, &secprops);
    if (result != SASL_OK) {
        setError("sasl_setprop(SASL_SEC_PROPS)", result);
        sasl_dispose(&conn);
        conn = 0;
        return false;
    }

    if (!externalUserName.empty()) {
        result = sasl_setprop(conn, SASL_AUTH_EXTERNAL, externalUserName.c_str());
        if (result != SASL_OK) {
            setError("sasl_setprop(SASL_AUTH_EXTERNAL)", result);
            sasl_dispose(&conn);
            conn = 0;
            return false;
        }

        result = sasl_setprop(conn, SASL_SSF_EXTERNAL, &externalSsf);
        if (result != SASL_OK) {
            setError("sasl_setprop(SASL_SSF_EXTERNAL)", result);
            sasl_dispose(&conn);
            conn = 0;
            return false;
        }
    }

    return true;
}

bool ClientImpl::setAttr(const string& key, const string& value)
{
    if (key == "service")
        serviceName = value;
    else if (key == "username")
        userName = value;
    else if (key == "authname")
        authName = value;
    else if (key == "password") {
        password = value;
        free(secret);
        secret = (sasl_secret_t*) malloc(sizeof(sasl_secret_t) + password.length());
    }
    else if (key == "host")
        hostName = value;
    else if (key == "externaluser")
        externalUserName = value;
    else {
        setError("setAttr", -1, "Unknown string attribute name", key);
        return false;
    }

    return true;
}

bool ClientImpl::setAttr(const string& key, uint32_t value)
{
    if (key == "minssf")
        minSsf = value;
    else if (key == "maxssf")
        maxSsf = value;
    else if (key == "externalssf")
        externalSsf = value;
    else if (key == "maxbufsize")
        maxBufSize = value;
    else {
        setError("setAttr", -1, "Unknown integer attribute name", key);
        return false;
    }

    return true;
}

bool ClientImpl::start(const string& mechList, string& chosen, string& initialResponse)
{
    int result;
    sasl_interact_t* prompt = 0;
    const char* resp;
    const char* mech;
    unsigned int len;

    do {
        result = sasl_client_start(conn, mechList.c_str(), &prompt, &resp, &len, &mech);
        if (result == SASL_INTERACT)
            interact(prompt);
    } while (result == SASL_INTERACT);
    if (result != SASL_OK && result != SASL_CONTINUE) {
        setError("sasl_client_start", result);
        return false;
    }

    chosen = string(mech);
    initialResponse = string(resp, len);
    return true;
}

bool ClientImpl::step(const string& challenge, string& response)
{
    int result;
    sasl_interact_t* prompt = 0;
    const char* resp;
    unsigned int len;

    do {
        result = sasl_client_step(conn, challenge.c_str(), challenge.size(), &prompt, &resp, &len);
        if (result == SASL_INTERACT)
            interact(prompt);
    } while (result == SASL_INTERACT);
    if (result != SASL_OK && result != SASL_CONTINUE) {
        setError("sasl_client_step", result);
        return false;
    }

    response = string(resp, len);
    return true;
}

bool ClientImpl::encode(const string& clearText, string& cipherText)
{
    const char* output;
    unsigned int outlen;
    int result = sasl_encode(conn, clearText.c_str(), clearText.size(), &output, &outlen);
    if (result != SASL_OK) {
        setError("sasl_encode", result);
        return false;
    }
    cipherText = string(output, outlen);
    return true;
}

bool ClientImpl::decode(const string& cipherText, string& clearText)
{
    const char* input = cipherText.c_str();
    unsigned int inLen = cipherText.size();
    unsigned int remaining = inLen;
    const char* cursor = input;
    const char* output;
    unsigned int outlen;

    clearText = string();
    while (remaining > 0) {
        unsigned int segmentLen = (remaining < maxBufSize) ? remaining : maxBufSize;
        int result = sasl_decode(conn, cursor, segmentLen, &output, &outlen);
        if (result != SASL_OK) {
            setError("sasl_decode", result);
            return false;
        }
        clearText = clearText + string(output, outlen);
        cursor += segmentLen;
        remaining -= segmentLen;
    }
    return true;
}

bool ClientImpl::getUserId(string& userId)
{
    int result;
    const char* operName;

    result = sasl_getprop(conn, SASL_USERNAME, (const void**) &operName);
    if (result != SASL_OK) {
        setError("sasl_getprop(SASL_USERNAME)", result);
        return false;
    }

    userId = string(operName);
    return true;
}

bool ClientImpl::getSSF(int *ssf)
{
    int result = sasl_getprop(conn, SASL_SSF, (const void **)&ssf);
    if (result != SASL_OK) {
        setError("sasl_getprop(SASL_SSF)", result);
        return false;
    }

    return true;
}

void ClientImpl::getError(string& _error)
{
    _error = error;
    error.clear();
}

void ClientImpl::addCallback(unsigned long id, void* proc)
{
    callbacks[cbIndex].id = id;
    callbacks[cbIndex].proc = (int (*)()) proc;
    callbacks[cbIndex].context = this;
    cbIndex++;
}

void ClientImpl::setError(const string& context, int code, const string& text, const string& text2)
{
    stringstream err;
    string errtext;

    if (text.empty()) {
        if (conn) {
            errtext = sasl_errdetail(conn);
        } else {
            errtext = sasl_errstring(code, NULL, NULL);
        }
    } else {
        errtext = text;
    }

    err << "Error in " << context << " (" << code << ") " << errtext;
    if (!text2.empty())
        err << " - " << text2;
    error = err.str();
}

void ClientImpl::interact(sasl_interact_t* prompt)
{
    string output;
    char* input;

    if (prompt->id == SASL_CB_PASS) {
        string ppt(prompt->prompt);
        ppt += ": ";
        char* pass = getpass(ppt.c_str());
        output = string(pass);
    } else {
        cout << prompt->prompt;
        if (prompt->defresult)
            cout << " [" << prompt->defresult << "]";
        cout << ": ";
        cin >> output;
    }
    prompt->result = output.c_str();
    prompt->len = output.length();
}

int ClientImpl::cbName(void *context, int id, const char **result, unsigned *len)
{
    ClientImpl* impl = (ClientImpl*) context;

    if (id == SASL_CB_USER || (id == SASL_CB_AUTHNAME && impl->authName.empty())) {
        *result = impl->userName.c_str();
        //*len    = impl->userName.length();
    } else if (id == SASL_CB_AUTHNAME) {
        *result = impl->authName.c_str();
        //*len    = impl->authName.length();
    }

    return SASL_OK;
}

int ClientImpl::cbPassword(sasl_conn_t *conn, void *context, int id, sasl_secret_t **psecret)
{
    ClientImpl* impl = (ClientImpl*) context;
    size_t length = impl->password.length();

    if (id == SASL_CB_PASS) {
        impl->secret->len = length;
        ::memcpy(impl->secret->data, impl->password.c_str(), length);
    } else
        impl->secret->len = 0;

    *psecret = impl->secret;
    return SASL_OK;
}
