# GitHub Repository Setup Guide

This document contains recommended settings for the GitHub repository.

## Repository Information

- **Repository**: https://github.com/vesnathan/card-counting-trainer
- **Default Branch**: `dev`
- **Production Branch**: `main`
- **Visibility**: Private (copyrighted project)

## General Settings

Navigate to: **Settings** > **General**

### Basic Settings
- **Default branch**: `dev`
- **Visibility**: Private
- **Template repository**: Unchecked

### Features
- ✅ **Issues**: Enabled (for bug reports)
- ❌ **Wikis**: Disabled (use documents/ folder instead)
- ❌ **Sponsorships**: Disabled
- ❌ **Projects**: Disabled (unless needed)
- ❌ **Discussions**: Disabled (use Issues for bug reports)

### Pull Requests
- ✅ **Allow merge commits**: Enabled
- ✅ **Allow squash merging**: Enabled
- ✅ **Allow rebase merging**: Enabled
- ✅ **Automatically delete head branches**: Enabled (cleanup after PR merge)
- ❌ **Allow auto-merge**: Disabled
- ❌ **Allow maintainer edits on pull requests**: Disabled (not accepting contributions)

### Archives
- ❌ **Include Git LFS objects in archives**: Disabled (not using LFS)

## Branch Protection Rules

Navigate to: **Settings** > **Branches** > **Add rule**

### Rule for `main` Branch

**Branch name pattern**: `main`

**Protect matching branches**:
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: **1** (your approval)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ❌ Require review from Code Owners (not applicable)
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Status checks: (add after setting up CI/CD)
    - `build`
    - `test`
    - `lint`
- ❌ **Require conversation resolution before merging**: Optional
- ❌ **Require signed commits**: Optional (recommended for security)
- ❌ **Require linear history**: Optional
- ❌ **Include administrators**: Do not allow bypassing the above settings
- ❌ **Allow force pushes**: Disabled
- ❌ **Allow deletions**: Disabled

### Rule for `dev` Branch

**Branch name pattern**: `dev`

**Protect matching branches**:
- ✅ **Require a pull request before merging**: Optional (up to you)
- ✅ **Allow force pushes**: Enabled (for you only)
  - Specify who can force push: Add yourself
- ❌ **Allow deletions**: Disabled

## Issues

Navigate to: **Settings** > **Issues**

### Issue Templates

Create issue templates at: `.github/ISSUE_TEMPLATE/`

**Bug Report Template** (`.github/ISSUE_TEMPLATE/bug_report.md`):
```markdown
---
name: Bug Report
about: Report a bug or issue with the game
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the Bug
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
What actually happened.

## Screenshots
If applicable, add screenshots to help explain your problem.

## Game State (if applicable)
- Number of decks: [e.g., 6]
- Current count: [e.g., +8]
- Hand details: [e.g., Player has 16, Dealer showing 10]

## Environment
- Browser: [e.g., Chrome, Safari]
- Device: [e.g., Desktop, Mobile]
- OS: [e.g., Windows, macOS, iOS]

## Additional Context
Add any other context about the problem here.
```

**Feature Suggestion Template** (`.github/ISSUE_TEMPLATE/feature_request.md`):
```markdown
---
name: Feature Suggestion
about: Suggest an idea for this project (note: external contributions not accepted)
title: '[SUGGESTION] '
labels: enhancement
assignees: ''
---

## Feature Description
A clear and concise description of the feature you'd like to see.

## Use Case
Describe the problem this feature would solve or the benefit it would provide.

## Proposed Solution
If you have ideas on how this could be implemented, describe them here.

## Alternatives Considered
Any alternative solutions or features you've considered.

## Additional Context
Add any other context, screenshots, or examples about the feature request here.

**Note**: This project does not accept external code contributions, but feature suggestions are welcome for consideration.
```

### Issue Labels

Default labels to create/modify:
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `gameplay` - Related to game mechanics
- `ui` - User interface issues
- `animation` - Card animation issues
- `wontfix` - This will not be worked on
- `duplicate` - This issue or pull request already exists

## Security

Navigate to: **Settings** > **Security**

### Dependency Graph
- ✅ **Dependency graph**: Enabled

### Dependabot Alerts
- ✅ **Dependabot alerts**: Enabled
- ✅ **Dependabot security updates**: Enabled

### Code Security and Analysis
- ✅ **Private vulnerability reporting**: Enabled
- ✅ **Secret scanning**: Enabled (for private repos on paid plans)
- ✅ **Push protection**: Enabled (prevents accidental secret commits)

### Security Policy

Create: `.github/SECURITY.md`
```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by opening a private security advisory:

1. Go to the Security tab
2. Click "Report a vulnerability"
3. Provide details about the vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

## Supported Versions

Security updates are applied to the latest version on the `main` branch.

## Security Best Practices

This project follows AWS security best practices:
- All API requests require authentication
- Sensitive data is encrypted at rest and in transit
- Environment variables are never committed to the repository
- AWS credentials are stored securely and rotated regularly
```

## Secrets (for GitHub Actions)

Navigate to: **Settings** > **Secrets and variables** > **Actions**

### Repository Secrets

Add these secrets for CI/CD workflows:
- `AWS_ACCESS_KEY_ID` - AWS access key for deployments
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for deployments
- `AWS_REGION` - AWS region (e.g., ap-southeast-2)
- `AWS_ACCOUNT_ID` - AWS account ID

**Note**: Never commit these values to the repository. Only store them in GitHub Secrets.

## Repository Topics

Navigate to: **Settings** > **General** > **Topics**

If you decide to make the repository public, add relevant topics:
- `nextjs`
- `typescript`
- `react`
- `tailwindcss`
- `blackjack`
- `card-counting`
- `game`
- `training`
- `educational`
- `canvas-animation`

## About Section

Navigate to: Repository homepage

**Description**: Interactive blackjack training game with card counting, basic strategy hints, and AI opponents. Practice your blackjack skills in a realistic casino environment.

**Website**: (Add your CloudFront domain after deployment)

## Collaborators and Teams

Navigate to: **Settings** > **Collaborators and teams**

- Add any team members with appropriate access levels
- Recommended: Use teams instead of individual collaborators for better management

## Webhooks (Optional)

Navigate to: **Settings** > **Webhooks**

Add webhooks for:
- Slack/Discord notifications on pushes/PRs
- Deployment triggers
- CI/CD pipeline triggers

## GitHub Actions Workflows (Future)

Create: `.github/workflows/`

Recommended workflows:
- `ci.yml` - Run tests and linting on PRs
- `deploy-dev.yml` - Deploy to dev environment on push to `dev`
- `deploy-prod.yml` - Deploy to production on push to `main`

## Repository Maintenance

### Regular Tasks
- Review and update dependencies monthly
- Review Dependabot security alerts weekly
- Clean up stale branches after merges
- Review and respond to bug reports
- Update documentation as features change

### Git Workflow
1. Feature branches created from `dev`
2. PRs submitted to `dev` for testing
3. After testing and approval, merge `dev` to `main` for production
4. Tag releases on `main` branch: `v1.0.0`, `v1.1.0`, etc.

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
