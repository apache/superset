package com.rvf.qa.pages;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import com.rvf.qa.base.TestBase;

public class ExploreChartPage extends TestBase{
	
	@FindBy(xpath="//div[@class='alert alert-warning']")
	WebElement warning;
	
	@FindBy(xpath="//div[@class='query-and-save btn-group']//button[1]")
	WebElement runQueryBtn;
	
	@FindBy(xpath="//div[@class='query-and-save btn-group']//button[2]")
	WebElement saveBtn;
	
	public ExploreChartPage() {
		PageFactory.initElements(driver, this);
	}
	
	public String verifyPageTitle() {
		return driver.getTitle();
	}
	
	public Boolean verifyWarning() {
		return warning.isDisplayed();
	}
	
	public Boolean verifyRunQueryBtnDisabled() {
		System.out.println(runQueryBtn.getText());
		System.out.println("*********************************************");
		System.out.println(isAttribtuePresent(runQueryBtn, "disabled"));
		System.out.println("*********************************************");
		return isAttribtuePresent(runQueryBtn, "disabled");
	}
	
	public Boolean verifySaveBtnDisabled() {
		return isAttribtuePresent(saveBtn, "disabled");
	}
	
	public String getWarningMessage() {
		if(verifyWarning())
			return warning.getText();
		else
			return null;
	}
	

	private boolean isAttribtuePresent(WebElement element, String attribute) {
		
		Boolean result = false;
		try {
			String value = element.getAttribute(attribute);
			if (value != null)
				result = true;
		} catch (Exception e) {}
		return result;
	}
	
}
