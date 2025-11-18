# Card Counting Trainer - Setup Plan

## Overview

Create a new application in the monorepo following the same architecture as The Story Hub, with minimal initial functionality focused on authentication.

## Architecture

### Frontend

- **Technology**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **Authentication**: AWS Amplify v6
- **Location**: `packages/card-counting-trainer/frontend/`

### Backend

- **API**: AWS AppSync (GraphQL)
- **Database**: DynamoDB (single table design with PK/SK pattern)
- **Authentication**: AWS Cognito User Pools
- **Resolvers**: TypeScript with AppSync JavaScript runtime
- **Location**: `packages/card-counting-trainer/backend/`

### Deployment

- **IaC**: CloudFormation templates (YAML)
- **Deploy Script**: TypeScript deployment automation
- **Location**: `packages/deploy/packages/card-counting-trainer/`
- **Templates**: `packages/deploy/templates/card-counting-trainer/`

## Initial Features (Phase 1)

### Frontend

1. **Main Page** (`app/page.tsx`)

   - Simple landing page
   - Login/Register buttons in top right corner
   - Responsive navbar component

2. **Authentication UI**

   - Login modal/page
   - Registration modal/page
   - Logout functionality
   - Display username when logged in

3. **Components**
   - `Navbar.tsx` - Navigation bar with auth buttons
   - `LoginForm.tsx` - Login form component
   - `RegisterForm.tsx` - Registration form component

### Backend

1. **GraphQL Schema** (`backend/schema/`)

   - `00-schema.graphql` - Base types and enums
   - `User.graphql` - User type and queries

2. **DynamoDB Schema**

   - User records: `PK: USER#<userId>`, `SK: METADATA`

3. **Resolvers** (`backend/resolvers/`)

   - `Query.getUser.ts` - Get current user info
   - `Query.getUserProfile.ts` - Get user profile by ID (optional)

4. **AppSync Configuration** (`templates/card-counting-trainer/resources/AppSync/appsync.yaml`)
   - GraphQL API
   - Cognito User Pool authorization
   - IAM authorization for public access
   - Resolver configurations

### Infrastructure

1. **CloudFormation Stacks**

   - `main.yaml` - Root stack
   - `resources/Cognito/cognito.yaml` - User Pool & Identity Pool
   - `resources/DynamoDB/dynamodb.yaml` - Single table
   - `resources/AppSync/appsync.yaml` - GraphQL API
   - `resources/IAM/iam.yaml` - Roles and policies

2. **Deployment Script** (`deploy/packages/card-counting-trainer/deploy.ts`)
   - Stack deployment orchestration
   - Frontend build process
   - Environment variable injection
   - Output management

## Files to Create

### Frontend Structure

```
packages/card-counting-trainer/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── lib/
│   │   ├── amplify-config.ts
│   │   ├── amplify-server-utils.ts
│   │   └── api/
│   │       └── user.ts
│   ├── graphql/
│   │   └── user.ts
│   └── types/
│       └── gqlTypes.ts (generated)
├── public/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── .gitignore
```

### Backend Structure

```
packages/card-counting-trainer/backend/
├── schema/
│   ├── 00-schema.graphql
│   └── User.graphql
├── resolvers/
│   └── User/
│       └── Queries/
│           └── Query.getUser.ts
├── scripts/
│   ├── merge-schema-for-appsync.ts
│   └── seed-db.ts
└── package.json
```

### Deployment Structure

```
packages/deploy/
├── packages/
│   └── card-counting-trainer/
│       └── deploy.ts
└── templates/
    └── card-counting-trainer/
        ├── main.yaml
        └── resources/
            ├── Cognito/
            │   └── cognito.yaml
            ├── DynamoDB/
            │   └── dynamodb.yaml
            ├── AppSync/
            │   └── appsync.yaml
            └── IAM/
                └── iam.yaml
```

## Implementation Steps

1. **Setup Project Structure**

   - Create frontend package with Next.js
   - Create backend package structure
   - Setup deployment scripts and templates

2. **Configure Authentication**

   - Create Cognito User Pool (CloudFormation)
   - Create Cognito Identity Pool for guest access
   - Configure Amplify in frontend

3. **Create GraphQL Schema**

   - Define User type
   - Define getUser query
   - Merge schema script

4. **Implement Backend Resolvers**

   - Create getUser resolver
   - Register resolvers in appsync.yaml

5. **Build Frontend Components**

   - Navbar with login/register buttons
   - Login form
   - Register form
   - Wire up Amplify authentication

6. **Create Deployment Configuration**

   - CloudFormation templates for all resources
   - Deployment script with build process
   - Environment variable management

7. **Setup Workspace Commands**
   - Add to root `package.json`:
     - `yarn dev:cct` - Start dev server
     - `yarn build:cct` - Build frontend
     - `yarn deploy:cct:dev` - Deploy to dev

## GraphQL Schema (Initial)

```graphql
# 00-schema.graphql
schema {
  query: Query
  mutation: Mutation
}

type Query {
  getUser: User @aws_cognito_user_pools @aws_iam
}

type Mutation {
  _empty: String
}

# User.graphql
type User {
  id: ID!
  email: String!
  username: String!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}
```

## DynamoDB Schema

### User Record

```
PK: USER#<userId>
SK: METADATA
GSI1PK: USER#<username>
GSI1SK: METADATA

Attributes:
- id: string (userId from Cognito)
- email: string
- username: string
- createdAt: string (ISO8601)
- updatedAt: string (ISO8601)
```

## Authentication Flow

1. **Registration**

   - User submits email/username/password
   - Cognito creates user account
   - User confirms email
   - User record created in DynamoDB via post-confirmation trigger (optional for Phase 1)

2. **Login**

   - User submits email/password
   - Cognito validates credentials
   - Amplify stores tokens
   - Frontend displays username

3. **Session Management**
   - Amplify handles token refresh
   - Frontend checks auth state on load
   - Logout clears tokens

## Environment Variables

### Frontend `.env.local`

```
NEXT_PUBLIC_ENVIRONMENT=dev
NEXT_PUBLIC_AWS_REGION=ap-southeast-2
NEXT_PUBLIC_USER_POOL_ID=<from-stack-outputs>
NEXT_PUBLIC_USER_POOL_CLIENT_ID=<from-stack-outputs>
NEXT_PUBLIC_IDENTITY_POOL_ID=<from-stack-outputs>
NEXT_PUBLIC_APPSYNC_ENDPOINT=<from-stack-outputs>
```

## Deployment Commands

```bash
# Deploy to dev
yarn deploy:cct:dev

# Deploy to prod
yarn deploy:cct:prod

# Start dev server
yarn dev:cct

# Build frontend
yarn build:cct
```

## Future Phases (Not Implemented Yet)

### Phase 2 - Card Counting Trainer

- Training mode with card deck
- Running count display
- True count calculation
- Practice statistics

### Phase 3 - User Progress

- Save training sessions
- Track accuracy and speed
- Historical performance graphs
- Leaderboards

### Phase 4 - Advanced Features

- Multiple counting systems (Hi-Lo, KO, Hi-Opt)
- Deck penetration settings
- Betting correlation
- Strategy deviation trainer

## Notes

- Follow The Story Hub patterns for consistency
- Use same deployment architecture
- Reuse utility functions where possible
- Keep initial scope minimal (auth only)
- No database seeding required initially
- No admin functionality in Phase 1
