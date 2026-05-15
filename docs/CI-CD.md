# CI/CD Pipeline for slak CLI

This document describes the automated build, test, and release pipeline for slak.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Trigger:** Every push and pull request to `main` or `dev` branches

**Jobs:**

#### `test` job
- **Runs on:** Ubuntu (latest)
- **Node versions:** 18.x, 20.x (matrix)
- **Steps:**
  1. Checkout code
  2. Setup Node.js + npm cache
  3. Install dependencies (`npm ci`)
  4. Type check (`npm run type-check`)
  5. Lint (`npm run lint`)
  6. Run tests (`npm test -- --run`)
  7. Generate coverage report (`npm run test:coverage`)
  8. Upload coverage to Codecov

#### `build` job (runs after `test` passes)
- **Runs on:** Ubuntu (latest)
- **Node version:** 20.x (stable)
- **Steps:**
  1. Checkout code
  2. Setup Node.js + npm cache
  3. Install dependencies
  4. Build TypeScript (`npm run build`)
  5. Check dist size (fail if > 100MB)
  6. Upload dist artifacts (retained 5 days)

**Exit criteria:**
- TypeScript strict mode passes
- All linting rules pass
- All tests pass with nock mocks
- Distribution size under 100MB

### 2. Release Workflow (`.github/workflows/release.yml`)

**Trigger:** Push of git tags matching `v*.*.*` (e.g., `v0.1.0`)

**Jobs:**

#### `release` job
- **Runs on:** Ubuntu (latest)
- **Permissions:** Write access to GitHub releases
- **Steps:**
  1. Checkout with full history
  2. Setup Node.js 20.x
  3. Install dependencies
  4. Type check
  5. Run full test suite
  6. Build distribution
  7. Generate oclif manifest
  8. Create GitHub Release (auto-generated notes)
  9. Publish to npm registry

**npm publishing:**
- Requires `NPM_TOKEN` secret in GitHub repo settings
- Token should have publish permission on `slak` package
- Publishes exactly what's in `npm ci` + `npm run build`

#### `build-and-attach` job (runs after `release` succeeds)
- **Runs on:** Matrix (ubuntu, macos, windows)
- **Steps per platform:**
  1. Checkout at release tag
  2. Setup Node.js
  3. Build distribution
  4. Create platform-specific archive:
     - Linux: `slak-linux-x64.tar.gz`
     - macOS: `slak-darwin-x64.tar.gz`
     - Windows: `slak-win32-x64.zip`
  5. Generate SHA256 checksums
  6. Attach archives + checksums to GitHub Release

## How to Release

### 1. Prepare Release
```bash
# Update version in package.json
npm version patch|minor|major

# This automatically:
# - Updates version field
# - Creates git commit
# - Creates git tag (v0.1.0)
```

### 2. Push Tag
```bash
# Push the tag (this triggers release workflow)
git push origin v0.1.0

# Or push all tags
git push origin --tags
```

### 3. GitHub Release is Created Automatically
- View at: https://github.com/anthropics/slak/releases
- Includes:
  - Auto-generated release notes from commits
  - Platform-specific distributions with checksums
  - dist/ artifacts for manual testing

### 4. npm Package is Published
- Available at: https://www.npmjs.com/package/slak
- Users can install: `npm install -g slak`

## Environment Setup

### Secrets Required (GitHub repo settings)

| Secret | Purpose | How to create |
|--------|---------|---------------|
| `NPM_TOKEN` | Publish to npm | https://www.npmjs.com/settings/~/tokens → Create token (publish) → Copy |
| `GITHUB_TOKEN` | Create releases (auto-generated) | Provided by GitHub Actions |

### Repository Settings

1. **Branch protection** (optional but recommended):
   - Branch: `main`
   - Require status checks to pass: CI workflow
   - Dismiss stale PR reviews on new commits
   - Require branches to be up to date before merging

2. **Actions permissions:**
   - Actions → General → Allow GitHub Actions to create and approve pull requests

## Troubleshooting

### CI Workflow Fails

**Type check fails:**
```bash
npm run type-check  # Run locally to debug
```

**Lint fails:**
```bash
npm run lint:fix    # Auto-fix most issues locally
```

**Tests fail:**
```bash
npm test            # Run full suite with verbose output
npm test -- --ui    # Run with interactive UI
```

**Build too large (> 100MB):**
```bash
du -sh dist         # Check current size locally
# Review src/ for large dependencies or assets
```

### Release Workflow Fails

**npm publish fails:**
- Check `NPM_TOKEN` is set and valid
- Verify token has publish scope
- Check package name isn't already published as different version

**GitHub Release not created:**
- Check `GITHUB_TOKEN` has repo write permission
- Verify tag format is `v*.*.*`

**Platform archives fail:**
- One OS failure doesn't block others (runs in parallel)
- Check runner OS has required build tools

## Deployment Strategy

### Manual Release
1. Test locally: `npm test && npm run type-check && npm run build`
2. Create version commit (or use `npm version patch`)
3. Tag commit: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`
5. Workflow runs automatically
6. Release published to GitHub + npm

### Automated Release from CI
Future: Can add workflow that auto-bumps version and creates release on merge to `main`.

## Monitoring Releases

- **GitHub Actions:** https://github.com/anthropics/slak/actions
- **Releases:** https://github.com/anthropics/slak/releases
- **npm:** https://www.npmjs.com/package/slak
- **Codecov:** https://codecov.io/gh/anthropics/slak

## File Locations

```
.github/
├── workflows/
│   ├── ci.yml          # Test + build on PR/push
│   └── release.yml     # Release on tag
docs/
└── CI-CD.md            # This file
```

## Version Strategy

Uses semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** (0→1): Breaking API changes
- **MINOR** (0→1): New features, backward compatible
- **PATCH** (0→1): Bug fixes, no behavior changes

Example release: `v0.1.5` → `v0.2.0` (new feature)
