# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from urllib.parse import quote

from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase


class TestRedirectView(SupersetTestCase):
    """Test the redirect view functionality"""

    def test_redirect_warning_external_url(self):
        """Test that external URLs show the warning page"""
        self.login(username="admin")

        external_url = "https://evil.com/phishing"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should return 200 and show warning page
        assert response.status_code == 200

        # Check that the warning page content is present
        assert b"You are leaving Apache Superset" in response.data
        assert external_url.encode() in response.data
        assert b"Continue to External Site" in response.data
        assert b"Go Back" in response.data

    def test_redirect_warning_multiple_external_urls(self):
        """Test various external URLs"""
        self.login(username="admin")

        external_urls = [
            "https://google.com",
            "http://example.org/page",
            "https://github.com/apache/superset",
        ]

        for url in external_urls:
            encoded_url = quote(url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should show warning page for all external URLs
            assert response.status_code == 200
            assert b"You are leaving Apache Superset" in response.data
            assert url.encode() in response.data

    @with_config({"WEBDRIVER_BASEURL": "http://localhost:8088/"})
    def test_redirect_internal_url_direct_redirect(self):
        """Test that internal URLs redirect directly without warning"""
        self.login(username="admin")

        internal_url = "http://localhost:8088/dashboard/1"
        encoded_url = quote(internal_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should redirect directly to the internal URL
        assert response.status_code in (301, 302, 303, 307, 308)
        assert response.location == internal_url

    def test_redirect_no_url_parameter(self):
        """Test redirect endpoint without URL parameter"""
        self.login(username="admin")

        response = self.client.get("/redirect/")

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_redirect_empty_url_parameter(self):
        """Test redirect endpoint with empty URL parameter"""
        self.login(username="admin")

        response = self.client.get("/redirect/?url=")

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_redirect_malformed_url(self):
        """Test redirect with malformed URL encoding"""
        self.login(username="admin")

        # Send a malformed percent-encoded URL
        response = self.client.get("/redirect/?url=%ZZ%XX%YY")

        # Should handle gracefully
        assert response.status_code in (200, 400)

    def test_redirect_requires_authentication(self):
        """Test that redirect endpoint requires authentication"""
        # Without login
        external_url = "https://evil.com"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should redirect to login
        assert response.status_code in (301, 302, 303, 307, 308)
        assert "/login/" in response.location or "login" in response.location.lower()

    def test_redirect_warning_page_content(self):
        """Test the content of the warning page"""
        self.login(username="admin")

        external_url = "https://suspicious-site.com/malware"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Check all expected elements are present
        assert response.status_code == 200

        # Warning message
        assert b"You are leaving Apache Superset" in response.data
        assert b"This link is sending you outside of Superset" in response.data

        # URL display
        assert external_url.encode() in response.data

        # Buttons
        assert b"Go Back" in response.data
        assert b"Continue to External Site" in response.data

        # Disclaimer
        assert b"not responsible for the content" in response.data

    def test_redirect_javascript_url(self):
        """Test that JavaScript URLs are handled safely"""
        self.login(username="admin")

        js_url = "javascript:alert('XSS')"
        encoded_url = quote(js_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should show warning page (not execute JavaScript)
        assert response.status_code == 200
        assert b"You are leaving Apache Superset" in response.data

    def test_redirect_data_url(self):
        """Test that data URLs are handled"""
        self.login(username="admin")

        data_url = "data:text/html,<script>alert('XSS')</script>"
        encoded_url = quote(data_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should show warning page
        assert response.status_code == 200
        assert b"You are leaving Apache Superset" in response.data

    @with_config({"WEBDRIVER_BASEURL": "https://superset.company.com/"})
    def test_redirect_with_configured_base_url(self):
        """Test redirect with a configured base URL"""
        self.login(username="admin")

        # Test internal URL with configured base
        internal_url = "https://superset.company.com/dashboard/list"
        encoded_url = quote(internal_url, safe="")

        response = self.client.get(
            f"/redirect/?url={encoded_url}", follow_redirects=False
        )

        # Should redirect directly (internal)
        assert response.status_code in (301, 302, 303, 307, 308)

        # Test external URL
        external_url = "https://other.company.com/page"
        encoded_url = quote(external_url, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # Should show warning page (external)
        assert response.status_code == 200
        assert b"You are leaving Apache Superset" in response.data

    def test_redirect_preserves_url_parameters(self):
        """Test that URL parameters are preserved in the redirect"""
        self.login(username="admin")

        url_with_params = "https://external.com/search?q=superset&page=1"
        encoded_url = quote(url_with_params, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # The full URL with parameters should be displayed
        assert response.status_code == 200
        assert url_with_params.encode() in response.data

    def test_redirect_handles_url_fragments(self):
        """Test that URL fragments (anchors) are preserved"""
        self.login(username="admin")

        url_with_fragment = "https://docs.example.com/guide#section-3"
        encoded_url = quote(url_with_fragment, safe="")

        response = self.client.get(f"/redirect/?url={encoded_url}")

        # The full URL with fragment should be displayed
        assert response.status_code == 200
        assert url_with_fragment.encode() in response.data

    def test_redirect_blocks_dangerous_schemes(self):
        """Test that dangerous URL schemes are blocked"""
        self.login(username="admin")

        dangerous_urls = [
            "javascript:alert('XSS')",
            "data:text/html,<script>alert('XSS')</script>",
            "vbscript:msgbox('XSS')",
            "file:///etc/passwd",
        ]

        for dangerous_url in dangerous_urls:
            encoded_url = quote(dangerous_url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should return 400 for dangerous schemes
            assert response.status_code == 400

    def test_redirect_whitespace_url_parameter(self):
        """Test redirect endpoint with whitespace-only URL parameter"""
        self.login(username="admin")

        response = self.client.get("/redirect/?url=   ")

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_redirect_case_insensitive_dangerous_schemes(self):
        """Test that scheme detection is case-insensitive"""
        self.login(username="admin")

        dangerous_urls = [
            "JAVASCRIPT:alert('XSS')",
            "Data:text/html,<script>alert('XSS')</script>",
            "VBScript:msgbox('XSS')",
            "FILE:///etc/passwd",
        ]

        for dangerous_url in dangerous_urls:
            encoded_url = quote(dangerous_url, safe="")
            response = self.client.get(f"/redirect/?url={encoded_url}")

            # Should return 400 for dangerous schemes regardless of case
            assert response.status_code == 400
