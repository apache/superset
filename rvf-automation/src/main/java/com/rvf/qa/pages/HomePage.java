package com.rvf.qa.pages;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import com.rvf.qa.base.TestBase;

public class HomePage extends TestBase{
	
	@FindBy(className="fa-bar-chart")
	WebElement chartsLink;
	
	public HomePage() {
		PageFactory.initElements(driver, this);
	}

	public String verifyHomePageTitle() {
		return driver.getTitle();
	}
	
	public ChartsListPage clickOnChartsLink() {
		chartsLink.click();
		return new ChartsListPage();
	}
}
