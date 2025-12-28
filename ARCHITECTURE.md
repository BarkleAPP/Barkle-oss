# Barkle V4 Architecture Documentation

This document provides a comprehensive overview of the Barkle V4 architecture, covering both backend and frontend structures, standards, and patterns.

## Table of Contents

- [Project Overview](#project-overview)
- [Backend Architecture](#backend-architecture)
  - [Technology Stack](#technology-stack)
  - [Directory Structure](#directory-structure)
  - [API Structure](#api-structure)
  - [Database Models](#database-models)
  - [API Endpoint Format](#api-endpoint-format)
  - [Migrations](#migrations)
  - [Authentication](#authentication)
  - [Workers and Queues](#workers-and-queues)
- [Frontend Architecture](#frontend-architecture)
  - [Technology Stack](#technology-stack-1)
  - [Directory Structure](#directory-structure-1)
  - [Component System](#component-system)
  - [Global Components](#global-components)
  - [State Management](#state-management)
  - [Routing](#routing)
  - [Styles and Theming](#styles-and-theming)
- [API Integration](#api-integration)
- [Development Workflow](#development-workflow)

## Project Overview

Barkle V4 is a monorepo project using pnpm workspace structure. The codebase consists of multiple packages:

- **backend**: Node.js API server
- **client**: Vue-based frontend app
- **sw**: Likely service worker package

The project uses modern JavaScript/TypeScript features including ES modules, and follows a component-based architecture.

## Backend Architecture

### Technology Stack

The backend uses the following technologies:

- **Node.js** with ES modules (`type: "module"`)
- **TypeScript**
- **TypeORM** for database operations
- **Koa** for HTTP server
- **Bull** for job queue processing
- **Redis** for caching and session management
- **PostgreSQL** for primary database
- **Elasticsearch** for search functionality
- **SWC** for TypeScript compilation

### Directory Structure

The backend follows a modular structure:

```
/packages/backend/src/
├── @types/            # TypeScript type definitions
├── boot/              # Application bootstrap code
├── config/            # Configuration files
├── daemons/           # Background services/processes
├── db/                # Database connections (Postgres, Redis, Elasticsearch)
├── mfm/               # MFM (Markup Format for Barkle) parser
├── models/            # Data models
│   ├── entities/      # TypeORM entities
│   ├── repositories/  # Data access layer
│   └── schema/        # JSON schema definitions
├── queue/             # Bull queue definitions
├── server/            # HTTP server
│   ├── api/           # API endpoints
│   │   ├── endpoints/ # API route handlers
│   │   └── openapi/   # API documentation
│   ├── file/          # File handling
│   ├── proxy/         # Proxy functionality
│   └── web/           # Web server functionality
└── services/          # Business logic services
```

### API Structure

The API uses a clear and consistent pattern for defining endpoints:

1. Endpoints are organized by resource type (users, notes, etc.)
2. Each endpoint defines metadata, parameter definitions, and the handler function
3. Authentication and permission checks are handled consistently

### Database Models

The application uses TypeORM with a rich entity model:

- Entities are defined using TypeORM decorators
- Relationships between entities are clearly defined
- Repositories provide an abstraction layer for database operations

Key entities include:
- User
- Note (posts/content)
- DriveFile (media files)
- Channel
- Notification
- UserList
- Emoji
- And many others

### API Endpoint Format

API endpoints follow a consistent definition pattern:

```typescript
export const meta = {
  tags: ['resource-type'],
  requireCredential: true,  // Whether authentication is required
  res: {
    type: 'array', // Response type
    optional: false, nullable: false,
    items: {
      type: 'object',
      ref: 'ModelName', // Reference to model schema
    },
  },
};

export const paramDef = {
  type: 'object',
  properties: {
    // Parameter definitions using JSON schema format
    param1: { type: 'string' },
    param2: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  },
  required: ['param1'],
};

export default define(meta, paramDef, async (ps, user, token) => {
  // Implementation of the endpoint
  // ps: parameters
  // user: authenticated user (if requireCredential is true)
  // token: authentication token
  
  // Return response data
});
```

### Migrations

Migrations follow the ES module format:

```typescript
export class MigrationName123456789 {
    name = 'MigrationName123456789'
    
    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "example_table" (
                "id" varchar NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_example_table" PRIMARY KEY ("id")
            )
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "example_table"`);
    }
}
```

Migration files must:
1. Use ES module syntax with `export class`
2. Include a `name` property that matches the class name
3. Use raw SQL queries with `queryRunner.query()`
4. Include both `up()` and `down()` methods

### Authentication

The backend uses multiple authentication methods:
- Token-based authentication for API access
- OAuth support for third-party applications
- Two-factor authentication (2FA) support

### Workers and Queues

The application uses Bull for background processing:
- Job queues for handling asynchronous tasks
- Bull Dashboard for monitoring queue status
- Redis as the queue storage backend

## Frontend Architecture

### Technology Stack

The frontend uses:
- **Vue.js 3** as the UI framework
- **Vite** as the build tool
- **TypeScript** for type safety
- **SCSS** for styling
- **Calckey-js** for API communication

### Directory Structure

```
/packages/client/src/
├── components/        # Vue components
│   ├── global/        # Global components
│   ├── form/          # Form-related components
│   └── page/          # Page components
├── directives/        # Vue directives
├── pages/             # Page definitions
├── scripts/           # Client-side scripts
├── store.ts           # State management
├── themes/            # Theme definitions
├── ui/                # UI utilities and components
└── widgets/           # Widget components
```

### Component System

The frontend uses a component-based architecture with Vue.js 3:

1. Components are prefixed with "Mk" (MissKey) or "Bk" (Barkle)
2. Each component is in a separate .vue file with SFC (Single File Component) format
3. Components handle their own styling and logic

### Global Components

Global components are defined in `/packages/client/src/components/global/` and can be used throughout the application without explicit imports. These components include:

- `MkA` - Link component
- `MkAvatar` - User avatar component
- `MkEmoji` - Emoji rendering
- `MkMisskeyFlavoredMarkdown` - Markdown renderer
- `MkPageHeader` - Page header component
- `MkUserName` - User name display component

**IMPORTANT**: These global components cannot be imported directly - they are registered globally and should be used directly in templates.

### State Management

The application uses a custom state management pattern:
- `store.ts` - Main application state
- `pizzax.ts` - Custom reactive state management utility
- Local component state for UI-specific state

### Routing

Routing is handled via:
- `router.ts` - Main router configuration
- `pages/` directory - Page components
- Dynamic component loading

### Styles and Theming

The application uses:
- SCSS for styling
- Theme system with swappable themes
- CSS variables for consistent styling
- Component-scoped styles

## API Integration

The frontend communicates with the backend through:

1. REST API calls for CRUD operations
2. WebSocket connections for real-time updates
3. Streaming API for live data

API requests follow this pattern:
1. Endpoints are called via the Calckey-js client library
2. Authentication tokens are managed automatically
3. Response data is typed based on API schemas

Example API call:
```typescript
// Get user notes
const notes = await api.request('users/notes', {
  userId: user.id,
  limit: 10,
});
```

## Custom Router System

The application uses a custom lightweight router called "NIRAX" instead of Vue Router. This system provides efficient route matching and navigation while maintaining a small footprint.

### Router Structure

The router system consists of:

1. **Route Definitions**: Defined in `router.ts` with path patterns, component mappings, and metadata
2. **NIRAX Router Engine**: Handles route resolution, navigation, and parameter extraction
3. **RouterView Component**: Renders the appropriate component based on current route

### Path Matching and Parameters

The router supports various path matching patterns:

- Static segments: `/settings`, `/notes`
- Dynamic parameters: `/:paramName`, like `/notes/:noteId`
- Optional parameters: `/:paramName?`
- Wildcard paths: `/:wildcard(*)`
- Query parameters via `?key=value`

### Parameter Extraction

When a URL is matched to a route:

1. The router parses the path segments and extracts parameters
2. Parameters are stored in a Map object
3. The matched component receives these parameters as props

### User Profile URL Handling

The user profile page (accessed via `/@username`) demonstrates how the custom router works:

1. **Route Definition**: In `router.ts`, user profiles are defined as:
   ```typescript
   {
     name: 'user',
     path: '/@:acct/:page?',
     component: page(() => import('./pages/user/index.vue')),
     meta: { isUserProfile: true },
   }
   ```

2. **Parameter Extraction**: When a user visits `/@username`:
   - The router matches the path against `/@:acct/:page?`
   - It extracts `username` as the value of the `acct` parameter
   - The optional `page` parameter is set if present (e.g., "home", "gallery")

3. **Component Rendering**: The user component receives these parameters:
   ```typescript
   // In user/index.vue
   const props = withDefaults(
     defineProps<{
       acct: string;
       page?: string;
     }>(),
     {
       page: 'home',
     },
   );
   ```

4. **Data Fetching**: The component uses the `acct` parameter to fetch user data:
   ```typescript
   function fetchUser(): void {
     if (props.acct == null) return;
     user.value = null;
     os.api('users/show', Acct.parse(props.acct))
       .then((u) => {
         user.value = u;
         // ...
       })
       .catch((err) => {
         error.value = err;
       });
   }
   ```

### Navigation

The router provides methods for navigation:

- `router.push(path)`: Navigate to a new page
- `router.replace(path)`: Replace current history entry with new page
- Event handling: Emits events for page changes, allowing components to react

### Global vs. Scoped Routers

The application uses:

- A main router (`mainRouter`) for the primary application
- Scoped routers for modal windows, allowing independent navigation within modals

## Development Workflow

The project uses the following workflow:

1. **Installation**: `pnpm install`
2. **Database Migration**: `pnpm run migrate`
3. **Build**: `pnpm run build`
4. **Development**: `pnpm run dev`
5. **Production Start**: `pnpm run start`

Custom scripts:
- `pnpm run migrateandstart` - Run migrations and start the server
- `pnpm run format` - Format code using the project's style guidelines
- `pnpm run lint` - Check code quality
- `pnpm run test` - Run tests
