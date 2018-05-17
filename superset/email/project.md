
README file for the superemail Superset plugin.
#TODO: write up how the whole plugin actually works...to be done after/during development

WORKFLOW:
Scheduler (Airflow)
    |
    |
    +---Build list of subscriptions that eed to be sent at current time
                    |
                    +--- Query superset.db to pull subscription data (dashboards, recips, etc)
                                +
                                |
                            Pull up to date data from Superset dash (phantomjs)
                                |
           +--------------------+
           |
           +--- Compose email
                    |
                    +---- Attach dashboard file
                                |
                                +----Send email


Still #TODO:
1) Build email subscription data structure
2) Build queries to pull and parse subscription data
3) Configure Airflow DAGS
4) Ensure all processes can be handled automatically and dynamically
5) UI component to build new subscriptions/manage current subscriptions


External requirments:
- Airflow instance installed/setup
- PhantomJS install and aliased to "phantomjs"


Notes:
- eventually would like to move away from PhantomJS so the data and visualizations are
  easier to work with as opposed to a simple screenshot


         
       