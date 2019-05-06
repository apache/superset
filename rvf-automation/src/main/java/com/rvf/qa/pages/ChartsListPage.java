package com.rvf.qa.pages;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import com.rvf.qa.base.TestBase;

public class ChartsListPage extends TestBase{
	
	@FindBy(xpath="//i[@class='fa fa-plus']")
	WebElement createChartsLink;
	
	public ChartsListPage() {
		PageFactory.initElements(driver, this);
	}

	public String verifyChartsPageTitle() {
		return driver.getTitle();
	}
	
	public CreateNewChartPage clickOnCreateNewChartBtn() {
		createChartsLink.click();
		return new CreateNewChartPage();
	}

}
