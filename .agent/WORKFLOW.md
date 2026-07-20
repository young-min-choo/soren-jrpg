# Workflow — How to Approach Each Task

## The Process (Follow Every Time)

### 1. Read Context
- Read `DESIGN-DOCUMENT.md` — the full spec
- Read `PROGRESS.md` — what's been done, what's next
- Read the relevant `.agent/` reference file for the task area

### 2. Pick One Goal
- Choose a single, concrete feature from the current build phase
- State it clearly: "I am implementing X"
- Keep it small — one scene, one system, one data file

### 3. Implement
- Write the code
- Follow existing project conventions (see `GAME-ENGINE.md`)
- Use the data structures defined in `DATA-STRUCTURE.md`
- Keep functions focused and readable

### 4. Test
- Run the dev server: `npx vite`
- Open in browser
- Verify the feature works (see `TESTING.md`)
- If broken, fix before moving on

### 5. Update Progress
- Append to `PROGRESS.md`:
  ```
  ## [Date] — Feature Name
  - What was implemented
  - What was tested
  - Any known issues
  ```

### 6. Verify Against Design Doc
- Does the implementation match `DESIGN-DOCUMENT.md`?
- If not, either fix the code or flag the discrepancy

## Anti-Patterns to Avoid

| Don't | Do instead |
|---|---|
| Implement multiple features at once | One feature, test, then next |
| Guess at design decisions | Check DESIGN-DOCUMENT.md |
| Skip testing | Always run and verify in browser |
| Leave broken code | Fix before moving to next feature |
| Refactor unrelated code | Touch only what the task requires |
| Add dependencies without checking | Check PREREQUISITES.md first |
| Hardcode values that should be data | Use JSON data files (see DATA-STRUCTURE.md) |

## Progressive Prompting Pattern

When the user gives a prompt like "implement the battle system," break it down:

1. **Understand:** What does the design doc say about combat?
2. **Scope:** What's the minimal version that works? (e.g., one battle, one enemy, Fight action only)
3. **Implement:** Build the minimal version
4. **Test:** Does it work?
5. **Iterate:** User gives feedback → adjust → test again
6. **Expand:** Add more features (Magic, Item, Defend, Flee) one at a time

This mirrors the Gothicvania approach: ~19 progressive prompts, each targeting one feature or bug.
Never try to build the full system in one shot.