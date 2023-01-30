pipeline {
    environment {
        registryCredential = 'dockerpush'
        jfrogRegistryCredential = 'jfrog_docker'
        jfrogURL = 'https://neom.jfrog.io'
        JFROG_TOKEN = credentials('JFROG_TOKEN')
        dockerImage = ''
        /* jdk = tool name: 'jdk' */
        /* JAVA_HOME = "${jdk}/jdk-11.0.1/" */
        VERSION = sh(returnStdout: true, script: "cat superset/__init__.py | sed 's/^.*__version__ = \"\\([^\"]*\\).*/\\1/'").trim()
    }

    agent {
        kubernetes {
            inheritFrom 'neos-superset' // all pods will be named with this prefix
            // idleMinutes 5  // how long the pod will live idle
            yamlFile '.build-pod.yaml' // path to the pod definition relative to the root
            defaultContainer 'docker' // define a default container - will default to jnlp container
        }
    }

    stages {
        stage('Test') {
            steps {
                container("python") {
                    withCredentials([usernamePassword(credentialsId: 'nortal_pypi_token', passwordVariable: 'pass', usernameVariable: 'user')]) {
                        sh "python -m pip install -r requirements/integration.txt"
                        sh "pre-commit run --all-files"
                    }
                }
            }
        }

        stage('Security Checks') {
            parallel {
                stage('KubeScore analysis') {
                    when {
                        anyOf {
                            branch "main"
                            branch "score"
                            buildingTag()
                        }
                    }
                    steps {
                        container("kube-score") {

                            script {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    sh "mkdir -p reports"
                                    sh "helm template chart | kube-score score -o ci - | tee reports/kube-scan.json"
                                    archiveArtifacts artifacts: 'reports/kube-scan.json', fingerprint: true
                                }
                            }
                        }
                    }
                }

                stage('Dependency analysis') {
                    steps {
                        container("trivy") {
                            catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                sh 'wget -c https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl'
                                sh 'mkdir -p reports && trivy filesystem --ignore-unfixed --vuln-type os,library --format template --template "@html.tpl" -o reports/scan.html ./'
                                publishHTML target : [
                                    allowMissing: true,
                                    alwaysLinkToLastBuild: true,
                                    keepAll: true,
                                    reportDir: 'reports',
                                    reportFiles: 'scan.html',
                                    reportName: 'Dependencies Scan',
                                    reportTitles: 'Depdndencies Scan'
                                ]
                            }
                        }
                    }
                }
            }
        }


        stage('Build tag') {
            when {
                not {
                    buildingTag()
                }
            }
            steps {
                script {
                    sh "sed -i 's/$VERSION/$VERSION-$BUILD_NUMBER/g' chart/Chart.yaml"
                    sh "sed -i 's/$VERSION/$VERSION-$BUILD_NUMBER/g' superset/__init__.py"
                    new_tag = "$VERSION-$BUILD_NUMBER"
                    imagetagname = "neos-core/neos-core-platform-superset:v$VERSION-$BUILD_NUMBER"
                    jfrogimagetagname = "neos-core-platform-superset/v$VERSION-$BUILD_NUMBER"
                }
            }
        }

        stage('Release tag') {
            when {
                buildingTag()
            }
            steps {
                script {
                    new_tag = "$VERSION"
                    imagetagname = "neos-core/neos-core-platform-superset:$TAG_NAME"
                    jfrogimagetagname = "neos-core-platform-superset/$TAG_NAME"
                }
            }
        }

        stage('Build') {
            when {
                anyOf {
                    branch "main"
                    branch "score"
                    buildingTag()
                }
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'nortal_pypi_token', passwordVariable: 'pass', usernameVariable: 'user')]) {
                        dockerImage = docker.build imagetagname, "--build-arg PYPI_USERNAME=$user --build-arg PYPI_PASSWORD=$pass ."
                        jfrogDockerImage = docker.build jfrogimagetagname, "--build-arg PYPI_USERNAME=$user --build-arg PYPI_PASSWORD=$pass ."
                    }
                }
            }
        }

        stage('Push') {
            when {
                anyOf {
                    branch "main"
                    buildingTag()
                }
            }
            parallel {
                stage('Docker Push') {
                    steps{
                        script {
                            docker.withRegistry( 'https://swr.ap-southeast-1.myhuaweicloud.com', registryCredential ) {
                                dockerImage.push()
                            }
                            docker.withRegistry(jfrogURL, jfrogRegistryCredential ) {
                               jfrogDockerImage.push()
                            }
                        }
                    }
                }
                stage('Helm Push') {
                    steps {
                        container("helm") {
                            script {
                                sh "helm plugin install https://github.com/chartmuseum/helm-push"
                                withCredentials([usernamePassword(credentialsId: 'helmpush_id', passwordVariable: 'pass', usernameVariable: 'user')]) {
                                    sh "helm repo add --username $user --password $pass charts-museum-dev https://charts.dev.neosdata.io"
                                    sh "helm cm-push chart/ charts-museum-dev"
                                }

                                sh "helm package chart/ -d ."
                                sh "curl -H \"X-JFrog-Art-Api:$JFROG_TOKEN\" -T *.tgz \"https://neom.jfrog.io/artifactory/neos-core-platform-superset-chart/\""
                            }
                        }
                    }
                }

            }
        }

        stage ('Docker Analysis') {
            when {
                    anyOf {
                        branch "main"
                        branch "score"
                        buildingTag()
                    }
                }
            steps {
                container("trivy") {
                    script {
                        sh "mkdir -p reports && trivy image --ignore-unfixed --format template --security-checks vuln --template '@html.tpl' -o reports/scan-docker.html ${imagetagname}"
                        publishHTML target : [
                            allowMissing: true,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: 'reports',
                            reportFiles: 'scan-docker.html',
                            reportName: 'Docker Scan',
                            reportTitles: 'Docker Scan'
                            ]
                    }
                }
            }
        }

        stage('Update Core Helm repository') {
            when {
                anyOf {
                    branch "main"
                    buildingTag()
                }
            }
            steps {
                container("git") {
                    script {
                        withCredentials([usernamePassword(credentialsId: 'devopscore-pat', passwordVariable: 'pass', usernameVariable: 'user')]) {
                            sh 'mkdir -p /tmp/helm && chown -R 1000:1000 /tmp/helm'
                            sh 'curl -L -s -o /usr/bin/yq https://github.com/mikefarah/yq/releases/download/v4.27.5/yq_linux_amd64 && chmod +x /usr/bin/yq'
                            sh "git config --global --add safe.directory '*'"
                            sh 'git config --global user.email "devopscore@nortal.com"'
                            sh 'git config --global user.name "devopscore"'
                            sh 'cd /tmp/helm/ && git clone https://${user}:${pass}@github.com/NEOS-Critical/neos-core-platform-helm.git'
                            sh "yq -i '.coreSuperset.tag = \"$new_tag\"' /tmp/helm/neos-core-platform-helm/neos-core/values.yaml"
                            sh "cd /tmp/helm/neos-core-platform-helm/ && git add neos-core/values.yaml && git commit -m 'Changed version for coreSuperset to \"$new_tag\"' && git push -f https://${user}:${pass}@github.com/NEOS-Critical/neos-core-platform-helm.git main"
                        }
                    }
                }
            }
        }

        stage('Notify') {
            when {
                anyOf {
                    branch "main"
                    buildingTag()
                }
            }
            steps {
                container("jnlp") {
                    script {
                        commit = sh(returnStdout: true, script: "git log -1 --oneline").trim()
                        slackSend color: "good", message: "neos-superset >> \nBuild successful - ${imagetagname} (<${env.BUILD_URL}|Open>) \n${commit}"
                    }
                }
            }
        }
    }
}
