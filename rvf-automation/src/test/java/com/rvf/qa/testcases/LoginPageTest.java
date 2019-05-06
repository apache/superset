package com.rvf.qa.testcases;

import java.io.IOException;

import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.rvf.qa.base.TestBase;
import com.rvf.qa.pages.HomePage;
import com.rvf.qa.pages.LoginPage;

public class LoginPageTest extends TestBase{

	LoginPage loginPage;
	HomePage homePage; 
	
	public LoginPageTest() throws IOException{
		// TODO Auto-generated constructor stub
		super();
	}
	
	@BeforeMethod
	public void setup() throws IOException {
		intialization();
		loginPage = new LoginPage();
	}
	
	@Test(priority=1)
	public void loginPageTitleTest() {
		String title = loginPage.validateLoginPageTitle();
		Assert.assertEquals(title.trim(), "Dashboard Builder");
	}
	
	@Test(priority=2)
	public void guavusLogoTest() {
		boolean logoDisplayed = loginPage.validateGuavusLogo();
		Assert.assertTrue(logoDisplayed);
	}
	
	@Test(priority=3)
	public void loginTest() {
		homePage = loginPage.login(prop.getProperty("username"), prop.getProperty("password"));
		Assert.assertNotNull(homePage);
	}
	
	@AfterMethod
	public void tearDown() {
		driver.quit();
	}
	
}
