package com.rvf.qa.pages;

import org.openqa.selenium.Keys;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import com.rvf.qa.base.TestBase;

public class CreateNewChartPage extends TestBase{
	
	@FindBy(xpath="//div[@class='Select-input']//input")
	WebElement selectDataSource;
	
	@FindBy(xpath="//div[@class='Select-placeholder']")
	WebElement selectPlaceHolder;
	
	@FindBy(xpath="//button[@class='btn btn-primary']")
	WebElement createChartBtn;
	
	
	public CreateNewChartPage() {
		PageFactory.initElements(driver, this);
	}
	
	public String verifyChartsPageTitle() {
		return driver.getTitle();
	}
	
	public void selectDataSource(String dataSource) {
		selectPlaceHolder.click();
		selectDataSource.sendKeys(dataSource);
		selectDataSource.sendKeys(Keys.ENTER);
	}
	
	public ExploreChartPage clickCreateChartBtn() {
		createChartBtn.click();
		return new ExploreChartPage();
	}
}
