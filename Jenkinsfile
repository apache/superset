@Library('jenkins_lib')_

pipeline {
  //agent {label 'slave'}
  agent {label 'nebula-slave03'}

    environment {
    // Define global environment variables in this
    WORKSPACE = pwd()
    supersetInventoryFilePath = 'superset-installer/etc/reflex-provisioner/inventory/templates/group_vars/global/all/raf/superset.yml'
    jenkinsInventoryFilePath = '${WORKSPACE}/${supersetInventoryFilePath}'
    testWithDatabase = 'py36-postgres'
    ARTIFACT_SRC1 = '.'
    ARTIFACT_DEST1 = 'ggn-dev-rpms/raf'
    SLACK_CHANNEL = 'jenkins-ui-alerts'
    CHECKSTYLE_FILE = 'target/checkstyle-result.xml'
    UNIT_RESULT = 'target/surefire-reports/*.xml'
    COBERTURA_REPORT = 'coverage.xml'
    ALLURE_REPORT = 'allure-report/'
    HTML_REPORT = 'superset/assets/output/coverage/jest/lcov-report/'
  }
  stages {

    stage("Define Release version"){
      steps {
        script {
          versionDefine()
        }
      }
    }

    stage("Update Superset Image Tag") {
      steps {
        // Updating Superset image tag in superset.yml
        echo "Updating Superset image tag"
        sh "make update_image_tag DOCKER_IMAGE_TAG=${env.dockerTag} SUPERSET_INVENTORY_FILE_PATH=${env.jenkinsInventoryFilePath}"
        echo "Updated Superset image tag"
      }
    }
    stage("Build and test") {
      parallel {

        stage("Unit test") {
          steps {
            echo "Starting unit test execution."
            sh "./scripts/execute_unittest.sh ${env.testWithDatabase}"
          }
        }
        stage("Code coverage") {
          steps {
            echo "Run Commmands to execute code coverage test"
          }
        }
        stage("Static code analysis or Checkstyle") {
          steps {
            echo "Run Commmands to execute static code analysis test"
          }
        }
      }
    }
    
    stage("Build or Compile") {
      steps {
        echo "Run Commmands to trigger build"
      }
    }

    stage("Code Coverage of JavaScript files") {
      steps {
        echo "Running Commmands to get code coverage of JavaScript Files"
             sh "tox -e javascript"
      }
    }

    stage('Code Quality with SonarQube') {
       steps {
        script {
          def scannerHome = tool 'sonar';
          withSonarQubeEnv('sonar') {
            echo "sonar"
            sh 'sonar-scanner -Dsonar.projectKey=incubator-superset -Dsonar.sources=. -Dsonar.exclusions=rvf-automation/**'
          }
        }
      }
    }

    stage('Create RPMs') {
      steps {
        echo "Run Commmand to trigger rpm build"
        sh  "./build_rpm.sh ${VERSION} ${RELEASE}"
      }
    }

    stage("Push rpm images in artifactory"){
      steps{
        script{
          rpm_push( env.buildType, 'dist/installer', 'ggn-dev-rpms/raf' )
        }
      }
    }

    stage("Deploy the particular plugin") {
      when {
        expression {
          env.buildType ==~ /(feature|PR-.*|fix)/
        }
      }
      steps {
        // Stubs should be used to perform functional testing
        echo "Deploy the Artifact on ephemeral environment"
      }
    }

    stage('Create Docker Image') {
      steps {
        echo "Creating docker build..."
        sh "make docker_build"
      }
    }

    stage('Tagging Docker Image') {
      steps {
        echo "Tagging docker image..."
        sh "make docker_tag DOCKER_IMAGE_TAG=${env.dockerTag}"
      }
    }

    stage("Push docker images to artifactory"){
      steps{
        script{
              docker_push( env.buildType, 'guavus-superset' )
        }
      }
    }

  }

  post {
    always {
      reports_alerts(env.CHECKSTYLE_FILE, env.UNIT_RESULT, env.COBERTURA_REPORT, env.ALLURE_REPORT, env.HTML_REPORT)
      slackalert('jenkins-ui-alerts')
    }
  }
}
