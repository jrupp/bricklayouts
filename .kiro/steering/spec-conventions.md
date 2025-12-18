# Spec Formatting Conventions

## Task List Structure

When creating implementation plans (tasks.md) for specs, use the following hierarchical structure:

### Parent Tasks as Containers
- Parent tasks should be **containers only** that group related sub-tasks
- Parent tasks should NOT contain implementation details or bullet points
- This allows flexibility to start either the entire parent task or individual sub-tasks

### Sub-Task Implementation Details
- All actual implementation details should be in sub-tasks
- Sub-tasks should include specific requirements references
- Sub-tasks should contain the actionable work items

### Example Format

**PREFERRED:**
```markdown
- [ ] 3. Implement percentage configuration section
  - [ ] 3.1 Create percentage configuration section HTML structure
    - Create percentage configuration section below Circle Type Selector
    - Add horizontal slider with 75% width, range 5-95, step 5
    - Add circle preview using BeerCSS progress element (25% width)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 3.2 Write property test for slider configuration
    - **Property 4: Percentage slider behavior**
    - **Validates: Requirements 3.3, 3.4, 3.5**
```

**AVOID:**
```markdown
- [ ] 3. Implement percentage configuration section
  - Create percentage configuration section below Circle Type Selector
  - Add horizontal slider with 75% width, range 5-95, step 5
  - Add circle preview using BeerCSS progress element (25% width)
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.1 Write property test for slider configuration
  - **Property 4: Percentage slider behavior**
  - **Validates: Requirements 3.3, 3.4, 3.5**
```

### Benefits of Container Structure
- **Flexibility**: Can choose to start entire parent task or individual sub-tasks
- **Granular Control**: Allows working on specific aspects without triggering all related tasks
- **Better Organization**: Clear separation between high-level goals and specific implementation steps
- **Task Management**: Easier to track progress on both broad objectives and detailed work items

## Property-Based Test Formatting

When including property-based tests in task lists:
- Always include the property number and description
- Reference the specific requirements being validated
- Use the exact format: `**Property X: Description**` and `**Validates: Requirements X.Y**`

## Optional Task Marking

- Use `*` suffix to mark optional tasks (typically tests and documentation)
- Only sub-tasks should be marked as optional, never parent tasks
- Example: `- [ ]* 3.2 Write unit tests for styling`