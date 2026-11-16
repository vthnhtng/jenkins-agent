pipeline {
  agent any
  parameters {
    choice(name: 'AGENT', choices: ['claudeCode', 'codex'], description: 'Main AI agent')
    string(name: 'CREDENTIALS_ID', defaultValue: 'claude-oauth-token', description: 'Secret Text credential holding the Claude token (injected as CLAUDE_CODE_OAUTH_TOKEN)')
    string(name: 'APP_SPEC', defaultValue: 'A simple greetings app in Node.js (no external dependencies). Module src/greetings.js exports greet(name) returning "Hello, <name>!" (trimmed name; "Hello, World!" when name is empty/missing) and greetByTime(name, date = new Date()) returning "Good morning/afternoon/evening, <name>!" (morning <12h, afternoon <18h, else evening). Also a CLI src/index.js that prints greet(process.argv[2]).', description: 'Description of the app to build')
    booleanParam(name: 'YOLO_MODE', defaultValue: true, description: 'Let the agent write files/run commands without asking (needed to create code & tests)')
  }
  environment {
    NODE_BIN = "${env.JENKINS_HOME}/tools/node-22/bin"
  }
  stages {
    stage('Setup isolated Node') {
      steps {
        sh '''
          set -e
          T="$JENKINS_HOME/tools/node-22"
          if [ ! -x "$T/bin/node" ]; then
            mkdir -p "$JENKINS_HOME/tools"; cd "$JENKINS_HOME/tools"
            base=https://nodejs.org/dist/latest-v22.x
            f=$(curl -fsSL $base/SHASUMS256.txt | grep -o 'node-v[0-9.]*-linux-x64.tar.gz' | head -1)
            echo "Downloading $f"
            curl -fsSL -o "$f" "$base/$f"
            mkdir -p node-22
            tar -xzf "$f" -C node-22 --strip-components=1
            rm -f "$f"
          fi
          export PATH="$T/bin:$PATH"
          node -v
          npx -v
        '''
      }
    }
    stage('AI: Generate tests') {
      steps {
        script {
          runAgent("""You are working in a Node.js repository (Node 22, no external dependencies).
Task: write the TESTS ONLY (test-driven development) for the following app. Do NOT write the implementation.

App spec: ${params.APP_SPEC}

Requirements:
- Create package.json (if missing) with "type": "commonjs" and a script "test": "node --test".
- Put tests in test/*.test.js using the built-in node:test and node:assert/strict modules.
- Cover normal input, empty/missing/whitespace names, and time-of-day boundaries (11:59, 12:00, 17:59, 18:00) using fixed Date objects.
- Tests must require the module from ../src/greetings.js.""")
        }
      }
    }
    stage('AI: Generate code') {
      steps {
        script {
          runAgent("""You are working in a Node.js repository (Node 22, no external dependencies).
Task: implement the app so that the existing tests in test/ pass. Do NOT modify the tests.

App spec: ${params.APP_SPEC}

Requirements:
- Create src/greetings.js and src/index.js (CLI) as described in the spec.
- Add a short README.md with usage.
- Run `npm test` and fix the implementation until all tests pass.""")
        }
      }
    }
    stage('Run tests') {
      steps {
        sh '''
          set -e
          export PATH="$NODE_BIN:$PATH"
          npm test
          node src/index.js Jenkins
        '''
      }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'ai-agent-raw.log', allowEmptyArchive: true }
  }
}
def runAgent(String promptText) {
  def nodeBin = "${env.JENKINS_HOME}/tools/node-22/bin"
  withEnv(["PATH+NODE=${nodeBin}"]) {
    def args = [
      prompt: promptText,
      yoloMode: params.YOLO_MODE
    ]
    if (params.CREDENTIALS_ID?.trim()) {
      args.apiCredentialsId = params.CREDENTIALS_ID.trim()
    }
    if (params.AGENT == 'claudeCode') {
      args.agent = claudeCode()
      args.apiEnvVarName = 'CLAUDE_CODE_OAUTH_TOKEN'
      args.executablePath = "${nodeBin}/npx"
    } else {
      args.agent = codex()
    }
    aiAgent(args)
  }
}
