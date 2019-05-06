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

public class CreateNewChartPageTest extends TestBase{
	
	HomePage homePage;
	LoginPage loginPage;
	ChartsListPage chartsPage;
	CreateNewChartPage createChart;
	ExploreChartPage exploreChartPage;
	
	public CreateNewChartPageTest() {
		super();
	}
	
	@BeforeMethod
	public void setup() throws IOException {
		intialization();
		loginPage = new LoginPage();
		homePage = loginPage.login(prop.getProperty("username"), prop.getProperty("password"));
		chartsPage = homePage.clickOnChartsLink();
		createChart = chartsPage.clickOnCreateNewChartBtn();
	}
	
	@Test(priority=1)
	public void createChartPageTitleTest() {
		String title = createChart.verifyChartsPageTitle();
		Assert.assertEquals(title.trim(), "Add new slice");
	}
	
	@Test(priority=2)
	public void createChart() {
		createChart.selectDataSource(prop.getProperty("dataSource"));
		exploreChartPage = createChart.clickCreateChartBtn();
		Assert.assertNotNull(exploreChartPage);
	}
	
	
	@AfterMethod
	public void tearDown() {
		driver.quit();
	}

}
