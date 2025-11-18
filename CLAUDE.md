# Card Counting Trainer - Development Guide

## 🔗 Cross-Project Reference

**IMPORTANT**: Before planning or implementing any feature, ALWAYS check other projects for similar implementations to ensure consistency across the codebase.

### Related Projects

All projects share common patterns for auth, routing, components, and AWS infrastructure:

- **Card Counting Trainer** (this project): `/home/liqk1ugzoezh5okwywlr_/dev/card-counting-trainer/`
  - Next.js frontend-focused application with complex game state management
  - Blackjack card counting training game
  - Reference this for: React hooks patterns, complex UI state, animations, game logic

- **The Story Hub**: `/home/liqk1ugzoezh5okwywlr_/dev/the-story-hub/`
  - Full-stack AWS AppSync/GraphQL application with Cognito auth
  - Complex AWS infrastructure (CloudFormation, AppSync, DynamoDB, CloudFront, Cognito)
  - Reference this for: GraphQL patterns, AWS deployment, authentication flows

- **CloudWatch Live**: `/home/liqk1ugzoezh5okwywlr_/dev/cloudwatchlive/`
  - Similar AWS architecture to The Story Hub
  - Reference this for: AWS monitoring patterns, alternative auth implementations

- **Lawn Order**: `/home/liqk1ugzoezh5okwywlr_/dev/lawn-order/`
  - Simpler Next.js application
  - Reference this for: Basic Next.js patterns, simple architectures

- **App Builder Studio**: `/home/liqk1ugzoezh5okwywlr_/dev/app-builder-studio/`
  - Landing page / marketing site
  - Reference this for: Static Next.js patterns, UI/UX components

### When to Check Other Projects

1. **Authentication & Authorization**
   - Check: The Story Hub, CloudWatch Live (Cognito patterns, auth hooks, protected routes)
   - Example: `frontend/src/hooks/useLoginController.tsx`, `frontend/src/lib/auth/`

2. **Form Handling & Validation**
   - Check: All projects for input validation, form submission patterns
   - Example: Registration forms, login forms, settings forms

3. **Next.js Routing & Layouts**
   - Check: All Next.js projects for consistent routing patterns
   - Example: `frontend/src/app/layout.tsx`, protected route wrappers

4. **AWS Infrastructure**
   - Check: The Story Hub (primary reference), CloudWatch Live (alternative patterns)
   - Example: CloudFormation templates, AppSync resolvers, Lambda functions

5. **Component Patterns**
   - Check: All projects for reusable UI components
   - Example: Buttons, modals, forms, navigation

6. **State Management**
   - Check: Card Counting Trainer (complex state), The Story Hub (GraphQL state)
   - Example: React hooks, context providers, custom hooks

7. **Styling & UI**
   - Check: All projects for Tailwind patterns, NextUI usage
   - Example: Consistent class naming, theme configuration

### Best Practices

- **Before creating new components**: Search other projects for similar functionality
- **Before implementing auth flows**: Check existing auth patterns in TSH/CWL
- **Before writing AWS infrastructure**: Reference existing CloudFormation templates
- **Before adding npm packages**: Check if other projects already use similar packages
- **Document deviations**: If you must deviate from patterns, document why in this file

---

# Card Counting Trainer - Project Notes

## Project Conventions

### Package Manager

- **ALWAYS use `yarn` exclusively** - never use npm
- Examples: `yarn install`, `yarn add`, `yarn workspace <name> <command>`

### Development Commands

- `yarn dev` - Start Card Counting Trainer frontend dev server (from root)
- `yarn build` - Build Card Counting Trainer frontend (from root)
- `yarn lint` - Run linter
- `yarn tsc` - Type check TypeScript without emitting files

### Deployments

**⚠️ CRITICAL: Claude MUST NEVER run deploy commands directly**
- **NEVER run any deployment commands** (e.g., `yarn deploy`, `npm run deploy`, AWS CLI deployments)
- **ONLY the user should run deployments** - they take a long time and should be manually controlled
- When the user asks about deployment, explain what needs to be deployed and what command they should run
- You may prepare code, templates, and configurations for deployment, but NEVER execute the deployment yourself

### Git Commit Process

- **ALWAYS run these commands BEFORE staging and committing**:
  1. `yarn lint` - Run linter to check for code style issues
  2. `yarn tsc` - Type check TypeScript without emitting files
  3. Format with Prettier if available
- Only proceed with `git add` and `git commit` after all checks pass
- This ensures code quality and catches errors before deployment
- Never skip these steps even for "simple" changes

---

## Notes for Future Sessions

- Always read this file at the start of a new session for context
- Update this file with significant changes, decisions, and pending work
- User prefers concise, technical communication
- Focus on facts and problem-solving over validation
