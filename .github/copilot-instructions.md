# Product Overview
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER TRY TO RUN TESTS OR RUN DEV OR TRY TO INSTALL DEPENDTS OR TRY TO DO ANYTHING LIKE THAT
# NEVER EVER FAKE DATA OR MAKE TODO FEATURES!
ALL DEVELOPED FEATURES SHOULD BE 100% WORKING
NEVER MAKE TEST COMPONENTS OR PAGES
DONT ADD TOO MUCH ANYLITCS OR TRACKING
ALWAYS USE i18N. if you find i18n isnt being used replace it with i18N
NEVER MAKE TESTSS

NEVER MAKE SIMULATED DATA EVER. IT WILL NEVER BE TOLERATED. ALSO NEVER MARK ANYTHING AS TODO OR FIXME OR ANYTHING LIKE THAT. EVERYTHING MUST BE PRODUCTION READY AND PRODUCTION QUALITY.

Barkle V4 is a modern open-source social platform. It's a full-featured social networking application with real-time capabilities, user profiles, content sharing, and community features. Built on the Misskey foundation with custom enhancements.

## Core Features

- **Social Networking**: User profiles, following/followers, timeline feeds
- **Content Creation**: Rich text posts (notes) with media attachments, polls, and reactions
- **Real-time Communication**: Live notifications, messaging, and streaming capabilities
- **Community Features**: Channels, hashtags, mentions, and user lists
- **Media Management**: File uploads, image/video processing, and gallery features
- **Moderation Tools**: Admin controls, content moderation, and user management
- **Customization**: Themes, custom emojis, and personalization options
- **Growth Features**: Onboarding flows, follow suggestions, and engagement analytics

## Target Audience

Modern social platform for community building and engagement.

## License

Barkle is open source software licensed under GNU GPL v3.0. It is built upon Misskey, and we acknowledge the original Misskey project for providing the foundation.

# Technology Stack

## 🚨 CRITICAL FRONTEND RULE - GLOBAL COMPONENTS 🚨
**NEVER IMPORT GLOBAL COMPONENTS** - Components in `packages/client/src/components/global/` are automatically registered and available everywhere. Just use them directly in templates without import statements. Importing them will cause build errors.

### Complete List of Global Components (DO NOT IMPORT):
- MkA, MkAcct, MkAd, MkAvatar, MkEllipsis, MkEmoji, MkError, MkLoading
- MkMisskeyFlavoredMarkdown, MkPageHeader, MkSpacer, MkStickyContainer
- MkTime, MkUrl, MkUserName

### ❌ WRONG:
```vue
import MkAvatar from '@/components/MkAvatar.vue';
import MkSpacer from '@/components/global/MkSpacer.vue';
```

### ✅ CORRECT:
```vue
<template>
  <MkSpacer>
    <MkAvatar :user="user" />
  </MkSpacer>
</template>
<!-- No imports needed for global components! -->

## Build System & Package Management
- **Package Manager**: Bun (v1.2.22) with pnpm workspaces for monorepo management
- **Build Tools**: 
  - SWC for TypeScript compilation (backend)
  - Vite for frontend bundling
  - Gulp for asset processing and copying tasks
- **Monorepo Structure**: 3 packages (backend, client, sw)

## Backend Stack

- **Runtime**: Node.js with ES modules
- **Language**: TypeScript 4.9.4
- **Framework**: Koa.js for HTTP server
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis and ioredis
- **Search**: Elasticsearch (optional)
- **Queue System**: Bull for job processing
- **Authentication**: Custom OAuth2 implementation
- **File Storage**: AWS S3 integration
- **Real-time**: WebSocket support

## Frontend Stack

- **Framework**: Vue.js 3 with Composition API
- **Language**: TypeScript 4.9.4
- **Build Tool**: Vite 4.3.9
- **Styling**: SCSS with custom themes
- **Router**: Custom NIRAX router
- **State Management**: Custom store implementation (Pizzax)
- **UI Components**: Custom component library with MK prefix

## Key Libraries

- **Media Processing**: Sharp, FFmpeg, Tesseract.js
- **Charts**: Chart.js with custom plugins
- **AI/ML**: TensorFlow.js, Brain.js
- **Payments**: Stripe integration
- **Push Notifications**: Firebase Admin SDK
- **Rich Text**: MFM (Markup For Misskey) parser
- **Emoji**: Twemoji support

## Common Commands

```bash
# Development
pnpm dev                    # Start development servers
pnpm build                  # Build all packages
pnpm rebuild                # Clean and rebuild everything

# Database
pnpm migrate                # Run database migrations
pnpm migrateandstart        # Migrate and start server

# Testing
pnpm test:simple            # Run simple tests (no DB required)
pnpm test:no-db            # Run Vitest without database
pnpm test                  # Run full test suite
pnpm cy:run                # Run Cypress e2e tests

# Production
pnpm start                 # Start production server
pnpm start:test            # Start test server

# Maintenance
pnpm clean                 # Clean build directories
pnpm lint                  # Run ESLint
pnpm format                # Format code with Gulp
```

## Development Environment

- **Node.js**: >= 18.19.0 required
- **Build Dependencies**: Python 3, C++ compiler, Make (for native modules)
- **Optional**: Docker for containerized development

# Project Structure

## Monorepo Organization

Barkle V4 uses a pnpm workspace monorepo with three main packages:


ALWAYS IGNORE QUESTIONS LIKE:
How do I fix the following problem in the above code?: Failed to write the global types file. Make sure that:

1. "node_modules" directory exists.
2. "vue" is installed as a direct dependency.

Alternatively, you can manually set "vueCompilerOptions.globalTypesPath" in your "tsconfig.json" or "jsconfig.json".

If all dependencies are installed, try running the "vue.action.restartServer" command to restart Vue and TS servers.


This is NOT me prompting you its the stupid ide

```
barkle-v4/
├── packages/
│   ├── backend/           # Node.js API server
│   ├── client/            # Vue.js frontend application  
│   └── sw/                # Service worker package
├── custom/                # Instance-specific assets and configs
├── locales/               # Internationalization files
├── scripts/               # Build and utility scripts
└── files/                 # User-uploaded files storage
```

## Backend Structure (`packages/backend/`)

```
src/
├── @types/                # TypeScript type definitions
├── boot/                  # Application bootstrap (master/worker)
├── config/                # Configuration loading and types
├── db/                    # Database connections (PostgreSQL, Redis, Elasticsearch)
├── models/                # TypeORM entities and repositories
│   ├── entities/          # Database entity definitions
│   ├── repositories/      # Data access layer
│   └── schema/            # API response schemas
├── server/                # HTTP server components
│   ├── api/               # REST API endpoints
│   ├── web/               # Web server and static assets
│   ├── file/              # File upload/download handling
│   └── proxy/             # Proxy and federation
├── services/              # Business logic layer
│   ├── note/              # Post/note related services
│   ├── user/              # User management services
│   ├── drive/             # File storage services
│   └── [feature]/         # Feature-specific services
├── queue/                 # Bull job queue processors
├── daemons/               # Background processes
└── misc/                  # Utility functions and helpers
```

## Frontend Structure (`packages/client/`)

```
src/
├── components/            # Vue components
│   ├── global/            # Globally registered components (MkEmoji, etc.)
│   ├── form/              # Form-related components
│   ├── growth/            # User growth and onboarding
│   ├── privacy/           # Privacy and compliance components
│   └── [feature]/         # Feature-specific components
├── pages/                 # Route-level page components
│   ├── admin/             # Admin panel pages
│   ├── settings/          # User settings pages
│   ├── user/              # User profile pages
│   └── [feature]/         # Feature-specific pages
├── ui/                    # Layout and UI shell components
│   ├── _common_/          # Shared UI components
│   ├── deck/              # Deck-style layout
│   └── visitor/           # Guest/visitor layouts
├── scripts/               # Utility functions and composables
├── services/              # Frontend service layer
├── themes/                # UI theme definitions
├── widgets/               # Dashboard widgets
├── locales/               # Frontend translations
└── store/                 # State management
```

## Naming Conventions

### Components
- **MK Prefix**: Core UI components use `Mk` prefix (e.g., `MkButton.vue`, `MkNote.vue`)
- **BK Prefix**: Barkle-specific components use `Bk` prefix (e.g., `BkLive.vue`)
- **PascalCase**: All Vue components use PascalCase naming

### Global Components - CRITICAL RULE
- **NEVER IMPORT GLOBAL COMPONENTS**: Components in `packages/client/src/components/global/` are automatically registered globally
- **Global components include**: MkSpacer, MkA, MkButton, MkEmoji, MkAvatar, MkUserName, MkTime, etc.
- **Just use them directly** in templates without importing - they are available everywhere
- **DO NOT** add import statements for global components - this will cause build errors
- **Example**: Use `<MkSpacer>` directly, never `import MkSpacer from '@/components/global/MkSpacer.vue'`

### Files & Directories
- **kebab-case**: Use kebab-case for file names and directories
- **Feature Grouping**: Group related files by feature/domain
- **Index Files**: Use `index.ts` for barrel exports

### API Endpoints
- **RESTful**: Follow REST conventions where applicable
- **Kebab-case**: Use kebab-case for endpoint paths
- **Versioning**: API versioning through path structure

## Configuration Files

- **Root Level**: Package management, build tools, Docker configs
- **Backend Config**: Located in `packages/backend/src/config/`
- **Frontend Config**: Vite config, TypeScript config per package
- **Custom Assets**: Instance-specific files in `custom/` directory

## Key Architectural Patterns

- **Monorepo**: Shared dependencies and coordinated releases
- **Service Layer**: Business logic separated from controllers
- **Repository Pattern**: Data access abstraction in backend
- **Component Composition**: Vue 3 Composition API throughout frontend
- **Feature Modules**: Code organized by business domain
- **Queue Processing**: Async job processing with Bull queues