# Contributing to @wsms/logger

Thanks for taking the time to contribute! :sparkles:

The following is a set of guidelines for contributing to **@wsms/logger**. These are mostly guidelines, not strict rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

- Use the **GitHub Issues** tracker
- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples (code snippets, log output, environment: Node version, OS)
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why

### Suggesting Enhancements

- Use GitHub Issues → choose "Feature request" if you set up templates (see below)
- Use a clear and descriptive title
- Provide as many details and examples as possible
- Describe the current behavior and the behavior you would like

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests (jest)
3. Ensure the test suite passes (`npm test`)
4. Run `npm run format` and `npm run lint`
5. Update the README.md / documentation with notable changes
6. Add / update tests for new/changed behavior
7. End your commit message with a conventional commit prefix (feat:, fix:, perf:, chore:, etc.)
8. Open the pull request against the `main` branch

We use **semantic-release** → please write conventional commits.

## Development Setup

```bash
git clone https://github.com/WhoStoleMySleepDev/logger.git
cd logger
npm install
npm run build    # tsup
npm test         # jest
npm run lint     # biome check
npm run format   # biome format --write
``` 

Happy to review small & focused PRs.

Thank you! ♥
