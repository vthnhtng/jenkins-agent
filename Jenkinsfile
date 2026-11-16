pipeline {
  agent any
  options { timestamps() }
  parameters {
    choice(name: 'AGENT', choices: ['claudeCode', 'codex'], description: 'Main AI agent')
    string(name: 'CREDENTIALS_ID', defaultValue: 'claude-oauth-token', description: 'Secret Text credential holding the Claude token (injected as CLAUDE_CODE_OAUTH_TOKEN)')
    string(name: 'GIT_CREDENTIALS_ID', defaultValue: 'github-ssh-key', description: 'SSH Username with private key credential used to push (needs the SSH Agent plugin)')
    string(name: 'BASE_BRANCH', defaultValue: 'main', description: 'Branch to start from')
    string(name: 'BRANCH', defaultValue: 'feature/greetings', description: 'Branch to create/update and push to')
    text(name: 'APP_SPEC', defaultValue: 'A simple greetings app in Node.js (no external dependencies). Module src/greetings.js exports greet(name) returning "Hello, <name>!" (trimmed name; "Hello, World!" when name is empty/missing) and greetByTime(name, date = new Date()) returning "Good morning/afternoon/evening, <name>!" (morning <12h, afternoon <18h, else evening). Also a CLI src/index.js that prints greet(process.argv[2]).', description: 'Description of the app to build (may be vague: the agent will ask questions)')
    booleanParam(name: 'YOLO_MODE', defaultValue: true, description: 'Let the agent write files/run commands without asking (needed to create code & tests)')
    booleanParam(name: 'REQUIRE_PLAN_APPROVAL', defaultValue: false, description: 'Always ask a developer to approve PLAN.md before coding')
    string(name: 'MAX_PLAN_ROUNDS', defaultValue: '3', description: 'Max clarification rounds with the developer')
    string(name: 'MAX_ITERATIONS', defaultValue: '3', description: 'Auto code/review/test rounds before asking the developer for guidance')
    string(name: 'INPUT_TIMEOUT_HOURS', defaultValue: '24', description: 'How long to wait for a developer answer before aborting')
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
    stage('AI: Plan & clarify') {
      steps {
        script {
          sh 'rm -f PLAN.md QUESTIONS.md REVIEW.md test.log'
          def answers = ''
          def maxRounds = (params.MAX_PLAN_ROUNDS ?: '3') as int

          runAgent(planPrompt(answers))

          // 1) Clarification loop: agent wrote QUESTIONS.md -> ask the developer
          for (int round = 1; fileExists('QUESTIONS.md'); round++) {
            if (round > maxRounds) {
              echo "Max clarification rounds reached; continuing with the agent's default assumptions."
              sh 'rm -f QUESTIONS.md'
              break
            }
            def questions = readFile('QUESTIONS.md')
            def reply = askDev("Round ${round}/${maxRounds}: the agent needs clarification.\n\n${questions}",
                               'Submit answers',
                               [text(name: 'ANSWERS', defaultValue: '', description: 'Answer the questions (reference them by number). Leave a question blank to accept its default.')])
            answers += "\n--- Round ${round} ---\nQuestions:\n${questions}\nDeveloper answers:\n${reply}\n"
            sh 'rm -f QUESTIONS.md'
            runAgent(planPrompt(answers))
          }

          // 2) Optional plan approval, with the option to send feedback and re-plan
          if (params.REQUIRE_PLAN_APPROVAL) {
            while (true) {
              def feedback = askDev("Please review the plan:\n\n${readFile('PLAN.md')}",
                                    'Approve / send feedback',
                                    [text(name: 'FEEDBACK', defaultValue: '', description: 'Leave EMPTY to approve. Otherwise describe the changes you want.')])
              if (!feedback?.trim()) { break }
              answers += "\n--- Plan feedback ---\n${feedback}\n"
              sh 'rm -f QUESTIONS.md'
              runAgent(planPrompt(answers))
            }
          }
          env.DEV_ANSWERS = answers
        }
      }
    }
    stage('AI: Code, review & test loop') {
      steps {
        script {
          int step = (params.MAX_ITERATIONS ?: '3') as int
          int budget = step
          int round = 0
          String feedback = ''
          String steer = ''
          boolean ok = false

          while (!ok) {
            round++
            echo "=== Iteration ${round} ==="
            runAgent(codePrompt(feedback, steer))

            sh 'rm -f REVIEW.md'
            runAgent(reviewPrompt())
            String verdict = fileExists('REVIEW.md') ? sh(returnStdout: true, script: 'head -n1 REVIEW.md').trim() : 'VERDICT: FAIL (REVIEW.md missing)'
            boolean reviewOk = verdict.startsWith('VERDICT: PASS')

            int rc = sh(returnStatus: true, script: '''
              export PATH="$NODE_BIN:$PATH"
              npm test > test.log 2>&1
            ''')
            sh 'tail -n 40 test.log || true'
            boolean testsOk = (rc == 0)

            echo "Review: ${verdict} | Tests: ${testsOk ? 'PASS' : 'FAIL'}"
            if (reviewOk && testsOk) { ok = true; break }

            feedback = ''
            if (!reviewOk) { feedback += "AI REVIEW FAILED:\n" + (fileExists('REVIEW.md') ? readFile('REVIEW.md') : verdict) + "\n\n" }
            if (!testsOk)  { feedback += "TESTS FAILED (tail of test.log):\n" + sh(returnStdout: true, script: 'tail -n 80 test.log') + "\n" }

            if (round >= budget) {
              def reply = askDev("Still failing after ${round} iterations.\n\nReview: ${verdict}\nTests: ${testsOk ? 'PASS' : 'FAIL'}\n\n${feedback.length() > 3000 ? feedback.substring(0, 3000) : feedback}",
                                 'Decide',
                                 [choice(name: 'ACTION', choices: ['Steer (give guidance, try again)', 'Push WIP branch and stop', 'Abort'], description: 'What should happen next?'),
                                  text(name: 'GUIDANCE', defaultValue: '', description: 'Used when you choose Steer: tell the agent what to do differently.')])
              if (reply.ACTION.startsWith('Steer')) {
                steer += "\n--- Developer guidance (after iteration ${round}) ---\n${reply.GUIDANCE}\n"
                budget += step
              } else if (reply.ACTION.startsWith('Push WIP')) {
                commitAll("wip: unfinished AI work (build #${env.BUILD_NUMBER}) - needs developer")
                pushRef("HEAD:refs/heads/wip/${env.TARGET_BRANCH}-${env.BUILD_NUMBER}")
                error("Stopped by developer. WIP pushed to wip/${env.TARGET_BRANCH}-${env.BUILD_NUMBER}")
              } else {
                error('Aborted by developer.')
              }
            }
          }
          env.CODE_OK = 'true'
        }
      }
    }
    stage('Commit') {
      when { expression { env.CODE_OK == 'true' } }
      steps {
        script { commitAll("feat: ${env.TARGET_BRANCH} (AI agent, build #${env.BUILD_NUMBER})") }
      }
    }
    stage('Push') {
      when { expression { env.CODE_OK == 'true' } }
      steps {
        script { pushRef("HEAD:refs/heads/${env.TARGET_BRANCH}") }
      }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'ai-agent-raw.log, PLAN.md, REVIEW.md, QUESTIONS.md, test.log', allowEmptyArchive: true }
  }
}

// ---------------------------------------------------------------- helpers

def askDev(String message, String okLabel, List inputParams) {
  timeout(time: (params.INPUT_TIMEOUT_HOURS ?: '24') as int, unit: 'HOURS') {
    return input(message: message, ok: okLabel, parameters: inputParams)
  }
}

def commitAll(String msg) {
  withEnv(["COMMIT_MSG=${msg}"]) {
    sh '''
      set -e
      git config user.name  "Jenkins AI Agent"
      git config user.email "jenkins-ai-agent@localhost"
      git add -A
      git reset -q -- PLAN.md REVIEW.md QUESTIONS.md test.log ai-agent-raw.log 2>/dev/null || true
      if git diff --cached --quiet; then
        echo "No changes to commit"
      else
        git commit -m "$COMMIT_MSG"
      fi
    '''
  }
}

def pushRef(String ref) {
  sshagent(credentials: [env.GIT_CRED]) {
    withEnv(["PUSH_REF=${ref}"]) {
      sh '''
        set -e
        git push origin "$PUSH_REF"
      '''
    }
  }
}

def planPrompt(String answers) {
  def known = answers?.trim() ? "\nDeveloper clarifications so far (treat as authoritative):\n${answers}\n" : ''
  return """You are working in a Node.js repository (Node 22, no external dependencies).
Task: PLAN ONLY. Do NOT write application code or tests in this step.

App spec: ${params.APP_SPEC}
${known}
Inspect the repository, then write a concise implementation plan to PLAN.md containing:
- files to create/change
- function/module signatures and behaviour
- test cases to write (edge cases included)
- how to run the tests (package.json script "test": "node --test")

Ambiguity handling:
- If the spec is ambiguous in ways that materially change the design or behaviour AND the developer clarifications above do not already settle it, write the open questions to QUESTIONS.md (numbered; for each, give a proposed default). Still write PLAN.md based on your proposed defaults.
- Only ask what truly matters (max 6 questions). If everything is clear, do NOT create QUESTIONS.md.
- Never re-ask something already answered above."""
}

def codePrompt(String feedback, String steer) {
  def fb = feedback?.trim() ? "\nPREVIOUS ATTEMPT FAILED. Fix these problems:\n${feedback}\n" : ''
  def st = steer?.trim() ? "\nDeveloper guidance (authoritative):\n${steer}\n" : ''
  def ans = env.DEV_ANSWERS?.trim() ? "\nDeveloper clarifications (authoritative):\n${env.DEV_ANSWERS}\n" : ''
  return """You are working in a Node.js repository (Node 22, no external dependencies).
Task: implement PLAN.md (read it first).
${ans}${st}${fb}
Requirements:
- Write tests first in test/*.test.js using node:test and node:assert/strict, then the implementation.
- Create package.json if missing with "type": "commonjs" and script "test": "node --test".
- Add a short README.md with usage.
- Run `npm test` and fix until all tests pass.
- NEVER weaken, skip or delete tests just to make them pass. Only change a test if it contradicts PLAN.md or the developer guidance, and say so in a code comment.
- Do not commit or push; do not delete PLAN.md."""
}

def reviewPrompt() {
  return """You are a strict code reviewer in a Node.js repository.
Task: review all uncommitted changes (use `git status`, `git diff`, and read new files).

- Check correctness vs PLAN.md, edge cases, test quality, readability and security.
- Check that tests were not weakened, skipped or made trivial.
- Do NOT edit code or tests yourself; only review.
- Write REVIEW.md. The FIRST LINE must be exactly `VERDICT: PASS` or `VERDICT: FAIL`.
  Use FAIL for any real bug, missing requirement, or weak/missing tests. After the first line, list the findings (file, problem, suggested fix)."""
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
