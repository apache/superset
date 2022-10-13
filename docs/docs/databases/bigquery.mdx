---
title: Google BigQuery
hide_title: true
sidebar_position: 20
version: 1
---

## Google BigQuery

The recommended connector library for BigQuery is
[pybigquery](https://github.com/mxmzdlv/pybigquery).

### Install BigQuery Driver

Follow the steps [here](/docs/databases/docker-add-drivers) about how to
install new database drivers when setting up Superset locally via docker-compose.

```
echo "pybigquery" >> ./docker/requirements-local.txt
```

### Connecting to BigQuery

When adding a new BigQuery connection in Superset, you'll need to add the GCP Service Account
credentials file (as a JSON).

1. Create your Service Account via the Google Cloud Platform control panel, provide it access to the
   appropriate BigQuery datasets, and download the JSON configuration file for the service account.
2. In Superset, you can either upload that JSON or add the JSON blob in the following format (this should be the content of your credential JSON file):

```
{
        "type": "service_account",
        "project_id": "...",
        "private_key_id": "...",
        "private_key": "...",
        "client_email": "...",
        "client_id": "...",
        "auth_uri": "...",
        "token_uri": "...",
        "auth_provider_x509_cert_url": "...",
        "client_x509_cert_url": "..."
    }
```

![CleanShot 2021-10-22 at 04 18 11](https://user-images.githubusercontent.com/52086618/138352958-a18ef9cb-8880-4ef1-88c1-452a9f1b8105.gif)

3. Additionally, can connect via SQLAlchemy URI instead

   The connection string for BigQuery looks like:

   ```
   bigquery://{project_id}
   ```

   Go to the **Advanced** tab, Add a JSON blob to the **Secure Extra** field in the database configuration form with
   the following format:

   ```
   {
   "credentials_info": <contents of credentials JSON file>
   }
   ```

   The resulting file should have this structure:

   ```
   {
    "credentials_info": {
        "type": "service_account",
        "project_id": "...",
        "private_key_id": "...",
        "private_key": "...",
        "client_email": "...",
        "client_id": "...",
        "auth_uri": "...",
        "token_uri": "...",
        "auth_provider_x509_cert_url": "...",
        "client_x509_cert_url": "..."
        }
    }
   ```

You should then be able to connect to your BigQuery datasets.

![CleanShot 2021-10-22 at 04 47 08](https://user-images.githubusercontent.com/52086618/138354340-df57f477-d3e5-42d4-b032-d901c69d2213.gif)

To be able to upload CSV or Excel files to BigQuery in Superset, you'll need to also add the
[pandas_gbq](https://github.com/pydata/pandas-gbq) library.
