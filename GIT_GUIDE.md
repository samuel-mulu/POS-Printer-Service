# Git Guide - From Initialization to Daily Use

A complete guide to using Git manually in your terminal.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Basic Commands](#basic-commands)
3. [Common Workflows](#common-workflows)
4. [Branching](#branching)
5. [Remote Repositories](#remote-repositories)
6. [Troubleshooting](#troubleshooting)

---

## Initial Setup

### 1. Check if Git is Installed

```bash
git --version
```

### 2. Configure Git (First Time Only)

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email
git config --global user.email "your.email@example.com"

# Check your configuration
git config --list
```

### 3. Initialize a New Repository

```bash
# Navigate to your project folder
cd "S:\projects master\3T JUICE\POS Printer Service"

# Initialize Git repository
git init

# This creates a hidden .git folder
```

---

## Basic Commands

### Check Repository Status

```bash
# See what files are changed, staged, or untracked
git status

# Short status (one line per file)
git status -s
```

### Stage Files (Add to Staging Area)

```bash
# Add a specific file
git add src/index.ts

# Add all files in current directory
git add .

# Add all files in the project
git add -A

# Add files interactively (choose what to add)
git add -i
```

### Commit Changes

```bash
# Commit with message
git commit -m "Add print queue system"

# Commit with detailed message (opens editor)
git commit

# Commit all tracked files (skip staging)
git commit -am "Quick commit message"
```

### View History

```bash
# View commit history
git log

# One line per commit
git log --oneline

# Graph view
git log --graph --oneline --all

# Last 5 commits
git log -5
```

### View Changes

```bash
# See what changed (unstaged)
git diff

# See what changed (staged)
git diff --staged

# See changes in a specific file
git diff src/index.ts
```

---

## Common Workflows

### Daily Workflow

#### 1. Check Status

```bash
git status
```

#### 2. See What Changed

```bash
git diff
```

#### 3. Stage Your Changes

```bash
# Add specific files
git add src/index.ts src/lib/printQueue.ts

# Or add all changes
git add .
```

#### 4. Commit

```bash
git commit -m "Description of your changes"
```

#### 5. Push to Remote (if connected)

```bash
git push
```

### Undo Changes

#### Discard Unstaged Changes

```bash
# Discard changes in a file
git checkout -- src/index.ts

# Discard all unstaged changes
git checkout -- .

# Modern way (Git 2.23+)
git restore src/index.ts
```

#### Unstage Files

```bash
# Unstage a file (keep changes)
git reset HEAD src/index.ts

# Modern way
git restore --staged src/index.ts
```

#### Undo Last Commit (Keep Changes)

```bash
# Undo commit but keep changes staged
git reset --soft HEAD~1

# Undo commit and unstage changes
git reset HEAD~1
```

#### Undo Last Commit (Discard Changes)

```bash
# ⚠️ WARNING: This permanently deletes changes
git reset --hard HEAD~1
```

---

## Branching

### Create and Switch Branches

```bash
# Create a new branch
git branch feature-name

# Switch to a branch
git checkout feature-name

# Create and switch in one command
git checkout -b feature-name

# Modern way (Git 2.23+)
git switch -c feature-name
```

### List Branches

```bash
# List local branches
git branch

# List all branches (local + remote)
git branch -a

# List remote branches
git branch -r
```

### Merge Branches

```bash
# Switch to main branch
git checkout main

# Merge feature branch
git merge feature-name
```

### Delete Branches

```bash
# Delete local branch
git branch -d feature-name

# Force delete (if not merged)
git branch -D feature-name

# Delete remote branch
git push origin --delete feature-name
```

---

## Remote Repositories

### Connect to Remote Repository

#### Add Remote

```bash
# Add GitHub/GitLab remote
git remote add origin https://github.com/username/repo-name.git

# Or SSH
git remote add origin git@github.com:username/repo-name.git

# View remotes
git remote -v
```

#### Push to Remote

```bash
# Push to remote (first time)
git push -u origin main

# Push to remote (subsequent times)
git push

# Push specific branch
git push origin branch-name
```

#### Pull from Remote

```bash
# Pull latest changes
git pull

# Pull from specific remote/branch
git pull origin main
```

#### Clone a Repository

```bash
# Clone a repository
git clone https://github.com/username/repo-name.git

# Clone to specific folder
git clone https://github.com/username/repo-name.git my-folder
```

---

## .gitignore File

Create a `.gitignore` file to exclude files from Git:

```bash
# Create .gitignore
touch .gitignore
```

Example `.gitignore` content:

```
# Dependencies
node_modules/

# Build output
dist/

# Environment variables
.env

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

---

## Useful Commands

### View Information

```bash
# Show current branch
git branch --show-current

# Show remote URL
git remote get-url origin

# Show last commit
git show

# Show file history
git log --follow src/index.ts
```

### Stash (Temporary Save)

```bash
# Save changes temporarily
git stash

# List stashes
git stash list

# Apply last stash
git stash pop

# Apply specific stash
git stash apply stash@{0}

# Delete stash
git stash drop
```

### Tagging

```bash
# Create a tag
git tag v1.0.0

# Create annotated tag
git tag -a v1.0.0 -m "Version 1.0.0"

# List tags
git tag

# Push tags
git push --tags
```

---

## Complete Workflow Example

### First Time Setup

```bash
# 1. Initialize repository
git init

# 2. Create .gitignore
# (create file manually or use: echo "node_modules/" > .gitignore)

# 3. Add all files
git add .

# 4. First commit
git commit -m "Initial commit"

# 5. Add remote (if you have one)
git remote add origin https://github.com/username/repo.git

# 6. Push to remote
git push -u origin main
```

### Daily Development

```bash
# 1. Check what changed
git status

# 2. See the changes
git diff

# 3. Stage files
git add .

# 4. Commit
git commit -m "Add new feature"

# 5. Push
git push
```

### Working with Features

```bash
# 1. Create feature branch
git checkout -b feature/print-queue

# 2. Make changes and commit
git add .
git commit -m "Implement print queue"

# 3. Switch back to main
git checkout main

# 4. Merge feature
git merge feature/print-queue

# 5. Push
git push

# 6. Delete feature branch
git branch -d feature/print-queue
```

---

## Troubleshooting

### Common Issues

#### "Your branch is ahead of origin/main"

```bash
# Push your commits
git push
```

#### "Your branch is behind origin/main"

```bash
# Pull latest changes
git pull
```

#### Merge Conflicts

```bash
# When merge conflict occurs:
# 1. Open conflicted files
# 2. Resolve conflicts (look for <<<<<<< markers)
# 3. Stage resolved files
git add .
# 4. Complete merge
git commit
```

#### Undo Last Push (Dangerous!)

```bash
# ⚠️ Only if you haven't shared with others
git reset --hard HEAD~1
git push --force
```

#### See What Files Were Changed in Last Commit

```bash
git show --name-only
```

---

## Quick Reference

| Command                | Description           |
| ---------------------- | --------------------- |
| `git init`             | Initialize repository |
| `git status`           | Check status          |
| `git add .`            | Stage all files       |
| `git commit -m "msg"`  | Commit changes        |
| `git push`             | Push to remote        |
| `git pull`             | Pull from remote      |
| `git log`              | View history          |
| `git diff`             | See changes           |
| `git branch`           | List branches         |
| `git checkout -b name` | Create branch         |
| `git merge branch`     | Merge branch          |
| `git clone url`        | Clone repository      |

---

## Best Practices

1. **Commit Often**: Small, logical commits are better
2. **Write Good Messages**: Clear, descriptive commit messages
3. **Use Branches**: Keep main/master stable
4. **Pull Before Push**: Always pull latest changes first
5. **Review Before Commit**: Use `git diff` to review changes
6. **Use .gitignore**: Don't commit unnecessary files

---

## Example Commit Messages

✅ Good:

- `"Add print queue system"`
- `"Fix authentication bug"`
- `"Update README with setup instructions"`

❌ Bad:

- `"fix"`
- `"update"`
- `"changes"`

---

## Next Steps

1. Initialize your repository: `git init`
2. Create `.gitignore` file
3. Make your first commit
4. Practice with branches
5. Connect to GitHub/GitLab (optional)

Happy coding! 🚀
