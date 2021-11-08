To pull our own superset-ui packages from our Artifacts Feed when building locally, the steps below should be followed.

# How to build locally
## Setup credentials
### Step 1
Copy the code below to your [user .npmrc](https://docs.microsoft.com/en-us/azure/devops/artifacts/npm/npmrc?view=azure-devops).
```
; begin auth token 
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/registry/:username=cccs-analytical-platform 
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/registry/:_password=[BASE64_ENCODED_PERSONAL_ACCESS_TOKEN] 
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/registry/:email=npm requires email to be set but doesn't use the value
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/:username=cccs-analytical-platform 
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/:_password=[BASE64_ENCODED_PERSONAL_ACCESS_TOKEN] 
//pkgs.dev.azure.com/cccs-analytical-platform/99130e50-b4e3-4d7d-873e-2a947f564b87/_packaging/analytical-platform/npm/:email=npm requires email to be set but doesn't use the value
; end auth token
```

### Step 2
Generate a [Personal Access Token](https://dev.azure.com/cccs-analytical-platform/_usersSettings/tokens) with Packaging read & write scopes.

### Step 3
Base64 encode the personal access token from Step 2.
One safe and secure method of Base64 encoding a string is to:
1. From a command/shell prompt run:
```
node -e "require('readline') .createInterface({input:process.stdin,output:process.stdout,historySize:0}) .question('PAT> ',p => { b64=Buffer.from(p.trim()).toString('base64');console.log(b64);process.exit(); })"
```
2. Paste your personal access token value and press Enter/Return
3. Copy the Base64 encoded value

### Step 4
Replace both [BASE64_ENCODED_PERSONAL_ACCESS_TOKEN] values in your user .npmrc file with your personal access token from Step 3.
