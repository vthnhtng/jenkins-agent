pipeline {
  agent any
  parameters {
    choice(name: 'AGENT', choices: ['claudeCode', 'codex'], description: 'Main AI agent')
    string(name: 'CREDENTIALS_ID', defaultValue: 'claude-oauth-token', description: 'Secret Text credential holding the Claude token (injected as CLAUDE_CODE_OAUTH_TOKEN)')
    string(name: 'GIT_CREDENTIALS_ID', defaultValue: 'github-ssh-key', description: 'SSH Username with private key credential used to push (needs the SSH Agent plugin)')
    string(name: 'BASE_BRANCH', defaultValue: 'main', description: 'Branch to start from')
    string(name: 'BRANCH', defaultValue: 'feature/greetings', description: 'Branch to create/update and push to')
    string(name: 'APP_SPEC', defaultValue: 'A simple greetings app in Node.js (no external dependencies). Module src/greetings.js exports greet(name) returning "Hello, <name>!" (trimmed name; "Hello, World!" when name is empty/missing) and greetByTime(name, date = new Date()) returning "Good morning/afternoon/evening, <name>!" (morning <12h, afternoon <18h, else evening). Also a CLI src/index.js that prints greet(process.argv[2]).', description: 'Description of the app to build')
    booleanParam(name: 'YOLO_MODE', defaultValue: true, description: 'Let the agent write files/run commands without asking (needed to create code & tests)')
  }
  environment {
    NODE_BIN = "${env.JENKINS_HOME}/tools/node-22/bin"
    TARGET_BRANCH = "${params.BRANCH ?: 'feature/greetings'}"
    BASE = "${params.BASE_BRANCH ?: 'main'}"
    GIT_CRED = "${params.GIT_CREDENTIALS_ID ?: 'github-ssh-key'}"
  }
  stages {
    stage('Checkout branch') {
      steps {
        checkout scm
        sshagent(credentials: [env.GIT_CRED]) {
          sh '''
            set -e
            git fetch origin
            if git ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
              git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
            elif git rev-parse --verify "origin/$BASE" >/dev/null 2>&1; then
              git checkout -B "$TARGET_BRANCH" "origin/$BASE"
            else
              git checkout -B "$TARGET_BRANCH"
            fi
            git log --oneline -3 || true
          '''
        }
      }
    }
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
    stage('AI: Plan') {
      steps {
        script {
          runAgent("""You are working in a Node.js repository (Node 22, no external dependencies).
Task: PLAN ONLY. Do NOT write any application code or tests in this step.

App spec: ${params.APP_SPEC}

Inspect the repository, then write a concise implementation plan to PLAN.md containing:
- files to create/change
- function signatures and behaviour
- test cases to write (including edge cases and time-of-day boundaries 11:59, 12:00, 17:59, 18:00)
- how to run the tests (package.json script "test": "node --test")""")
        }
      }
    }
    stage('AI: Code') {
      steps {
        script {
          runAgent("""You are working in a Node.js repository (Node 22, no external dependencies).
Task: implement PLAN.md (read it first).

Requirements:
- Write tests first in test/*.test.js using node:test and node:assert/strict, then the implementation (src/greetings.js, src/index.js).
- Create package.json if missing with "type": "commonjs" and script "test": "node --test".
- Add a short README.md with usage.
- Run `npm test` and fix until all tests pass.
- Do not commit or push; do not delete PLAN.md.""")
        }
      }
    }
    stage('AI: Review') {
      steps {
        script {
          runAgent("""You are a strict code reviewer in a Node.js repository.
Task: review all uncommitted changes (use `git status` and `git diff`, and read new files).

- Check correctness vs PLAN.md, edge cases, test quality, readability, and security issues.
- Fix any real problems you find directly in the code/tests.
- Write a short summary of findings and fixes to REVIEW.md.
- Run `npm test` and make sure it passes.
- Do not commit or push.""")
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
    stage('Commit') {
      steps {
        sh '''
          set -e
          git config user.name  "Jenkins AI Agent"
          git config user.email "jenkins-ai-agent@localhost"
          git add -A
          # keep working files and logs out of the commit
          git reset -q -- PLAN.md REVIEW.md ai-agent-raw.log 2>/dev/null || true
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "feat: add greetings app with tests (generated by AI agent, build #${BUILD_NUMBER})"
          fi
        '''
      }
    }
    stage('Push') {
      steps {
        sshagent(credentials: [env.GIT_CRED]) {
          sh '''
            set -e
            mkdir -p ~/.ssh
            ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null || true
            git push -u origin "$TARGET_BRANCH"
          '''
        }
      }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'ai-agent-raw.log, PLAN.md, REVIEW.md', allowEmptyArchive: true }
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
