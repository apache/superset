package com.rvf.qa.testcases;

import java.io.IOException;

import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.rvf.qa.base.TestBase;
import com.rvf.qa.pages.ChartsListPage;
import com.rvf.qa.pages.CreateNewChartPage;
import com.rvf.qa.pages.HomePage;
import com.rvf.qa.pages.LoginPage;

public class ChartsListPageTest extends TestBase{
	
	HomePage homePage;
	LoginPage loginPage;
	ChartsListPage chartsPage;
	CreateNewChartPage createNewChartPage;
	
	public ChartsListPageTest() {
		super();
	}
	
	@BeforeMethod
	public void setup() throws IOException {
		intialization();
		loginPage = new LoginPage();
		homePage = loginPage.login(prop.getProperty("username"), prop.getProperty("password"));
		chartsPage = homePage.clickOnChartsLink();
	}
	
	@Test(priority=1)
	public void chartsListPageTitleTest() {
		String title = chartsPage.verifyChartsPageTitle();
		Assert.assertEquals(title.trim(), "Dashboard Builder");
	}
	
	@Test(priority=2)
	public void createNewChart() {
		createNewChartPage = chartsPage.clickOnCreateNewChartBtn();
		Assert.assertNotNull(createNewChartPage);
	}
	
	@AfterMethod
	public void tearDown() {
		driver.quit();
	}

}
