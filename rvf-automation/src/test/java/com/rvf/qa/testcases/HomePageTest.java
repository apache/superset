package com.rvf.qa.testcases;

import java.io.IOException;

import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.rvf.qa.base.TestBase;
import com.rvf.qa.pages.HomePage;
import com.rvf.qa.pages.LoginPage;

public class HomePageTest extends TestBase{

	HomePage homePage;
	LoginPage loginPage;
	
	public HomePageTest() {
		super();
	}
	
	@BeforeMethod
	public void setup() throws IOException {
		intialization();
		loginPage = new LoginPage();
		homePage = loginPage.login(prop.getProperty("username"), prop.getProperty("password"));
	}
	
	@Test(priority=1)
	public void homePageTitleTest() {
		String title = homePage.verifyHomePageTitle();
		Assert.assertEquals(title.trim(), "Superset");
	}
	
	@AfterMethod
	public void tearDown() {
		driver.quit();
	}
}
