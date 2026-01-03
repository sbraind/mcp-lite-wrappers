---
name: resolve-conflicts
description: Resolve git merge conflicts from Swarm execution. Use when merge command reports conflicts and saves pending-conflicts.json.
---

# Resolve Swarm Conflicts

This skill resolves git merge conflicts that occurred during Swarm merge operations.

## When to Use

When `swarm merge` reports conflicts and tells you to run `/resolve-conflicts`.

## Workflow

1. Read `.claude/swarm/pending-conflicts.json`
2. For each conflicted file:
   - Analyze both versions (ours vs theirs)
   - Understand what each side is trying to accomplish
   - Propose a merged resolution that preserves both intentions
   - Apply the resolution to the file
   - Stage the file with `git add`
3. Commit the merge
4. Clear pending conflicts
5. Instruct user to run merge again

## Resolution Strategy

When resolving conflicts:

1. **Don't just pick one side** - Merge the intentions of both
2. **If both add different things** - Include both in logical order
3. **If both modify the same thing** - Combine the changes intelligently
4. **Preserve code style** - Match the existing formatting
5. **Keep imports sorted** - If both add imports, merge and sort them

## Execution Steps

```
1. Read pending conflicts file
2. For each conflict:
   a. Read the file with conflict markers
   b. Show user what each side changed
   c. Propose resolution
   d. Write resolved content
   e. git add <file>
3. git commit -m "Merge [branch] (conflicts resolved via Claude Code)"
4. Delete pending-conflicts.json
5. Tell user to run: swarm merge
```

## Example Resolution

Given conflict:
```
<<<<<<< HEAD
function greet(name) {
  return `Hello, ${name}!`;
}
=======
function greet(name, formal = false) {
  return formal ? `Good day, ${name}.` : `Hi ${name}`;
}
>>>>>>> swarm/bt-101
```

Resolution:
```typescript
function greet(name: string, formal = false) {
  if (formal) {
    return `Good day, ${name}.`;
  }
  return `Hello, ${name}!`;
}
```

Why: Combined the formality option from theirs with the friendly greeting from ours.

## After Resolution

Tell the user:
```
Conflicts resolved and committed. Run:
swarm merge
```
