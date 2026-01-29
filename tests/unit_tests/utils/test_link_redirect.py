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


import pytest
from flask import Flask

from superset.utils.link_redirect import is_safe_redirect_url, process_html_links


@pytest.fixture
def app():
    """Create a Flask app for testing"""
    app = Flask(__name__)
    app.config["WEBDRIVER_BASEURL"] = "http://superset.example.com/"
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "http://superset.example.com/"
    app.config["ALERT_REPORTS_EXTERNAL_LINK_INDICATOR"] = True
    return app


def test_process_html_links_external_urls(app):
    """Test that external URLs are replaced with redirect URLs"""
    with app.app_context():
        html = """
        <div>
            <a href="https://evil.com/phishing">Click here</a>
            <a href="http://external.site/page">External link</a>
        </div>
        """

        result = process_html_links(html)

        # Check that external links are redirected
        assert "/redirect/?url=https%3A%2F%2Fevil.com%2Fphishing" in result
        assert "/redirect/?url=http%3A%2F%2Fexternal.site%2Fpage" in result

        # Check that external-link class is added
        assert 'class="external-link"' in result or "class='external-link'" in result


def test_process_html_links_internal_urls(app):
    """Test that internal URLs are not modified"""
    with app.app_context():
        html = """
        <div>
            <a href="http://superset.example.com/dashboard/1">Dashboard</a>
            <a href="http://superset.example.com/chart/list">Charts</a>
        </div>
        """

        result = process_html_links(html)

        # Check that internal links are NOT redirected
        assert "http://superset.example.com/dashboard/1" in result
        assert "http://superset.example.com/chart/list" in result
        assert "/redirect/?" not in result


def test_process_html_links_mixed_urls(app):
    """Test processing HTML with both internal and external URLs"""
    with app.app_context():
        html = """
        <div>
            <a href="http://superset.example.com/dashboard/1">Internal Dashboard</a>
            <a href="https://external.com/page">External Page</a>
            <a href="/relative/path">Relative Path</a>
            <a href="mailto:user@example.com">Email</a>
        </div>
        """

        result = process_html_links(html)

        # Internal link should not be redirected
        assert "http://superset.example.com/dashboard/1" in result

        # External link should be redirected
        assert "/redirect/?url=https%3A%2F%2Fexternal.com%2Fpage" in result

        # Relative paths and non-http(s) links should not be modified
        assert "/relative/path" in result
        assert "mailto:user@example.com" in result


def test_process_html_links_empty_or_none(app):
    """Test handling of empty or None HTML content"""
    with app.app_context():
        assert process_html_links(None) is None
        assert process_html_links("") == ""
        assert process_html_links("   ") == "   "


def test_process_html_links_no_links(app):
    """Test HTML without any links"""
    with app.app_context():
        html = "<div><p>This is some text without any links.</p></div>"
        result = process_html_links(html)
        assert "This is some text without any links." in result
        assert "/redirect/?" not in result


def test_process_html_links_already_redirected(app):
    """Test that already redirected URLs are not double-redirected"""
    with app.app_context():
        html = """
        <div>
            <a href="/redirect/?url=https%3A%2F%2Fexternal.com">Already redirected</a>
        </div>
        """

        result = process_html_links(html)

        # Should not double-redirect
        assert result.count("/redirect/?") == 1


def test_process_html_links_complex_html(app):
    """Test processing complex HTML with various elements"""
    with app.app_context():
        html = """
        <table>
            <tr>
                <td><a href="https://evil.com">External</a></td>
                <td><a href="http://superset.example.com/dashboard">Internal</a></td>
            </tr>
        </table>
        <p>Some text with <a href="https://google.com">a link</a> in it.</p>
        <ul>
            <li><a href="https://github.com">GitHub</a></li>
            <li><a href="#anchor">Anchor link</a></li>
        </ul>
        """

        result = process_html_links(html)

        # External links should be redirected
        assert "/redirect/?url=https%3A%2F%2Fevil.com" in result
        assert "/redirect/?url=https%3A%2F%2Fgoogle.com" in result
        assert "/redirect/?url=https%3A%2F%2Fgithub.com" in result

        # Internal link should not be redirected
        assert "http://superset.example.com/dashboard" in result

        # Anchor link should not be modified
        assert "#anchor" in result


def test_process_html_links_with_custom_base_url(app):
    """Test processing with a custom base URL"""
    with app.app_context():
        html = """
        <a href="https://mycompany.com/page">Company Page</a>
        <a href="https://external.com/page">External Page</a>
        """

        result = process_html_links(html, base_url="https://mycompany.com")

        # mycompany.com link should not be redirected
        assert "https://mycompany.com/page" in result

        # external.com link should be redirected
        assert "/redirect/?url=https%3A%2F%2Fexternal.com%2Fpage" in result


def test_process_html_links_disable_indicator(app):
    """Test disabling the external link indicator"""
    app.config["ALERT_REPORTS_EXTERNAL_LINK_INDICATOR"] = False

    with app.app_context():
        html = '<a href="https://external.com">External</a>'
        result = process_html_links(html)

        # Should have redirect but no external-link class
        assert "/redirect/?url=https%3A%2F%2Fexternal.com" in result
        assert "external-link" not in result


def test_process_html_links_malformed_html(app):
    """Test that malformed HTML is handled gracefully"""
    with app.app_context():
        html = """
        <div>
            <a href="https://external.com">Unclosed link
            <p>Some text</p>
        """

        # Should not raise an exception
        result = process_html_links(html)

        # Should still process the link
        assert "/redirect/?" in result


def test_is_safe_redirect_url(app):
    """Test is_safe_redirect_url function"""
    with app.app_context():
        # Internal URLs should be safe
        assert is_safe_redirect_url("http://superset.example.com/dashboard")
        assert is_safe_redirect_url("http://superset.example.com/chart/1")

        # External URLs should not be safe
        assert not is_safe_redirect_url("https://evil.com")
        assert not is_safe_redirect_url("http://external.site/page")

        # Empty or None URLs should not be safe
        assert not is_safe_redirect_url("")
        assert not is_safe_redirect_url(None)


def test_is_safe_redirect_url_with_custom_base(app):
    """Test is_safe_redirect_url with custom base URL"""
    with app.app_context():
        base_url = "https://mycompany.com"

        # mycompany.com URLs should be safe
        assert is_safe_redirect_url("https://mycompany.com/page", base_url)

        # Other URLs should not be safe
        assert not is_safe_redirect_url("https://external.com/page", base_url)


def test_is_safe_redirect_url_uses_configured_base_urls(app):
    """Test that both base URL configs are considered for internal safety checks."""
    app.config["WEBDRIVER_BASEURL"] = "http://localhost:8088/"
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "http://superset.example.com/"

    with app.app_context():
        assert is_safe_redirect_url("http://localhost:8088/dashboard/1")


def test_process_html_links_no_base_url_configured(app):
    """Test behavior when no base URL is configured"""
    app.config["WEBDRIVER_BASEURL"] = ""
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = ""

    with app.app_context():
        html = '<a href="https://external.com">External</a>'
        result = process_html_links(html)

        # Should return unchanged HTML when no base URL configured
        assert result == html


def test_process_html_links_whitespace_only_content(app):
    """Test processing whitespace-only content"""
    with app.app_context():
        assert process_html_links("   ") == "   "
        assert process_html_links("\n\t  \n") == "\n\t  \n"


def test_process_html_links_empty_href_values(app):
    """Test handling of empty href values"""
    with app.app_context():
        html = '<a href="">Empty href</a><a href="  ">Whitespace href</a>'
        result = process_html_links(html)

        # Should not modify empty or whitespace-only hrefs
        assert 'href=""' in result
        assert 'href="  "' in result
        assert "/redirect/?" not in result


def test_is_safe_redirect_url_case_insensitive(app):
    """Test that host comparison is case-insensitive"""
    with app.app_context():
        # Should be safe regardless of case
        assert is_safe_redirect_url("http://SUPERSET.EXAMPLE.COM/dashboard")
        assert is_safe_redirect_url("http://Superset.Example.Com/chart")


def test_is_safe_redirect_url_relative_urls(app):
    """Test that relative URLs are considered safe"""
    with app.app_context():
        assert is_safe_redirect_url("/dashboard/1")
        assert is_safe_redirect_url("../chart/list")
        assert is_safe_redirect_url("page.html")


def test_is_safe_redirect_url_no_base_configured(app):
    """Test behavior when no base URL is configured"""
    app.config["WEBDRIVER_BASEURL"] = ""
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = ""

    with app.app_context():
        # Should return False when no base URL is configured
        assert not is_safe_redirect_url("https://external.com")


def test_process_html_links_invalid_base_url(app):
    """Test behavior with invalid base URL"""
    app.config["WEBDRIVER_BASEURL"] = "not-a-valid-url"
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "not-a-valid-url"

    with app.app_context():
        html = '<a href="https://external.com">External</a>'
        result = process_html_links(html)

        # Should return unchanged HTML when base URL is invalid
        assert result == html


def test_process_html_links_feature_disabled(app):
    """Test behavior when feature is disabled"""
    app.config["ALERT_REPORTS_ENABLE_LINK_REDIRECT"] = False

    with app.app_context():
        html = '<a href="https://external.com">External</a>'
        result = process_html_links(html)

        # Should return unchanged HTML when feature is disabled
        assert result == html


def test_process_html_links_large_html(app):
    """Test processing very large HTML content"""
    with app.app_context():
        # Create large HTML content
        large_html = (
            "<div>" + '<a href="https://external.com">External</a>' * 1000 + "</div>"
        )
        result = process_html_links(large_html)

        # Should still process correctly
        assert "/redirect/?" in result
        assert result.count("/redirect/?") == 1000  # All links should be processed


def test_process_html_links_protocol_relative_urls(app):
    """Test that protocol-relative URLs are handled and redirected"""
    with app.app_context():
        html = """
        <div>
            <a href="//evil.com/phishing">Protocol relative external</a>
            <a href="//superset.example.com/dashboard">Protocol relative internal</a>
        </div>
        """

        result = process_html_links(html)

        # Protocol-relative external link should be converted to https and redirected
        assert "/redirect/?url=https%3A%2F%2Fevil.com%2Fphishing" in result

        # Protocol-relative internal link should be converted but not redirected
        assert "https://superset.example.com/dashboard" in result
        # Should not have redirect for internal
        assert "superset.example.com%2Fdashboard" not in result
