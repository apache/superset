package com.rvf.qa.testcases;

import java.io.IOException;

import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.rvf.qa.base.TestBase;
import com.rvf.qa.pages.ChartsListPage;
import com.rvf.qa.pages.CreateNewChartPage;
import com.rvf.qa.pages.ExploreChartPage;
import com.rvf.qa.pages.HomePage;
import com.rvf.qa.pages.LoginPage;

public class ExploreChartPageTest extends TestBase{

	HomePage homePage;
	LoginPage loginPage;
	ChartsListPage chartsPage;
	CreateNewChartPage createChart;
	ExploreChartPage exploreChart;
	
	public ExploreChartPageTest() {
		super();
	}
	
	@BeforeMethod
	public void setup() throws IOException, InterruptedException {
		intialization();
		loginPage = new LoginPage();
		homePage = loginPage.login(prop.getProperty("username"), prop.getProperty("password"));
		chartsPage = homePage.clickOnChartsLink();
		createChart = chartsPage.clickOnCreateNewChartBtn();
		createChart.selectDataSource(prop.getProperty("dataSource"));
		exploreChart = createChart.clickCreateChartBtn();
		Thread.sleep(2000);
	}
	
	@Test(priority=1)
	public void exploreChartTitleTest() {
		String title = exploreChart.verifyPageTitle();
		String actualTitle = "Explore - " + prop.getProperty("dataSource").split("\\.")[1];
		//String actualTitle = "Explore - " + prop.getProperty("dataSource");
		Assert.assertEquals(title.trim(), actualTitle);
	}
	
	@Test(priority=2)
	public void verifyWarningPresent() {
		Assert.assertTrue(exploreChart.verifyWarning());
	}
	
	@Test(priority=3)
	public void verifyRunQueryBtnDisabled() {
		Assert.assertTrue(exploreChart.verifyRunQueryBtnDisabled());
	}
	
	@Test(priority=4)
	public void verifySaveBtnDisabled() {
		Assert.assertTrue(exploreChart.verifySaveBtnDisabled());
	}
	
	@Test(priority=5)
	public void verifyWarningMessage() {
		Assert.assertEquals(exploreChart.getWarningMessage(), "Empty query?");
	}
	
	@AfterMethod
	public void tearDown() {
		driver.quit();
	}
}
