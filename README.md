# Barkle V4

<div align="center">
  <img src="custom/dogo.png" alt="Barkle Logo" width="200">
  <h3>A modern social platform built with Node.js and Vue.js</h3>
</div>

> **Open Source**: Barkle is an open-source social platform, forked from [Misskey](https://github.com/misskey-dev/misskey) and [Calckey](https://codeberg.org/calckey/calckey), released under the GNU General Public License v3.0. We acknowledge and thank the Misskey and Calckey development teams for creating the foundation this project builds upon.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Development](#-development)
- [Building for Production](#-building-for-production)
- [Project Structure](#-project-structure)
- [Available Scripts](#-available-scripts)
- [Testing](#-testing)
- [Docker Support](#-docker-support)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Documentation](#-documentation)
- [Credits](#-credits)

## 🔍 Overview

Barkle  is a modern social platform organized as a monorepo using pnpm workspaces. It features a robust backend API server built with Node.js and TypeScript, and a responsive frontend application using Vue.js 3. Built upon the foundation of Misskey and Calckey, Barkle extends and customizes the platform with additional features and improvements.

## ✨ Features

- **User Profiles** - Customizable user profiles with follow/follower capabilities
- **Timeline** - Real-time post updates
- **Notes System** - Rich text posting with media attachment support
- **Mentions & Tags** - User mentions and hashtag support
- **Media Management** - Image and video uploads with storage management
- **Channel System** - Topic-based discussion channels
- **Real-time Notifications** - Instant updates for interactions
- **Custom Theming** - User-customizable interface themes
- **Search Functionality** - Find users, notes, and hashtags
- **Admin Tools** - Comprehensive moderation capabilities

## 🛠 Technology Stack

### Backend
- **Node.js** with ES modules
- **TypeScript**
- **TypeORM** for database operations
- **Koa** for HTTP server
- **Bull** for job queue processing
- **PostgreSQL** for primary database
- **Redis** for caching and session management
- **Elasticsearch** for search functionality

### Frontend
- **Vue.js 3** with Composition API
- **TypeScript**
- **Vite** build tooling
- **SCSS** for styling
- **Custom router** (NIRAX)
- **calckey-js** for API interactions

## 📋 Requirements

- **Node.js** >= 18.19.0
- **pnpm** >= 3.6.4
- **PostgreSQL** >= 14
- **Redis** (for job queue and caching)
- **Elasticsearch** (optional, for enhanced search capabilities)
- **Build tools** (for native modules):
  - Python 3 (for node-gyp)
  - C++ compiler (gcc/g++)
  - Make

## 🚀 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/BarkleAPP/Barkle-oss.git
cd Barkle-oss
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set up configuration**:
Copy example configuration files and modify as needed.

4. **Initialize the database**:
```bash
pnpm run migrate
```

5. **Build the project**:
```bash
pnpm run build
```

## ⚙️ Configuration

Configuration files should be placed in the `packages/backend/config` directory. You'll need to configure:

- Database connection settings
- Redis connection settings
- Elasticsearch (optional)
- File storage options
- SMTP for email (optional)
- Instance-specific settings

## 💻 Development

Start the development server:
```bash
pnpm run dev
```

This will start both the backend and frontend development servers with hot reloading.

## 🏗️ Building for Production

1. **Clean the build directory**:
```bash
pnpm clean
```

2. **Build all packages**:
```bash
pnpm run build
```

3. **Run database migrations**:
```bash
pnpm migrate
```

4. **Start the production server**:
```bash
pnpm start
```

## 📁 Project Structure

```
barkle-v4/
├── packages/           # Workspace packages
│   ├── backend/        # Backend API server
│   │   ├── src/        # Source code
│   │   │   ├── @types/ # TypeScript type definitions
│   │   │   ├── boot/   # Application bootstrap code
│   │   │   ├── config/ # Configuration files
│   │   │   ├── models/ # Data models and entities
│   │   │   ├── server/ # HTTP server components
│   │   │   │   ├── api/      # API endpoints
│   │   │   │   └── web/      # Web server
│   │   │   └── services/     # Business logic services
│   │   └── built/     # Compiled backend code
│   │
│   ├── client/        # Frontend Vue application
│   │   ├── src/       # Source code
│   │   │   ├── components/  # Vue components
│   │   │   │   └── global/  # Global components
│   │   │   ├── pages/      # Page components
│   │   │   ├── store.ts    # State management
│   │   │   └── router.ts   # Routing configuration
│   │   └── built/    # Compiled frontend code
│   │
│   └── sw/           # Service worker package
│
├── custom/           # Custom assets and configurations
│   ├── assets/       # Custom assets
│   └── locales/      # Localization files
│
└── scripts/         # Utility scripts
```

## 📜 Available Scripts

- **`pnpm dev`** - Start development servers
- **`pnpm build`** - Build all packages
- **`pnpm rebuild`** - Clean and rebuild all packages
- **`pnpm start`** - Start the production server
- **`pnpm start:test`** - Start the test server
- **`pnpm migrate`** - Run database migrations
- **`pnpm revertmigration`** - Revert the last migration
- **`pnpm migrateandstart`** - Run migrations and start the server
- **`pnpm clean`** - Clean build directories
- **`pnpm clean-all`** - Clean all build and cache directories
- **`pnpm lint`** - Run linting
- **`pnpm test`** - Run tests
- **`pnpm format`** - Format code

## ✅ Testing

Barkle V4 supports multiple testing approaches to accommodate different development environments.

### Database-Free Testing (Recommended)

This approach doesn't require a database and is ideal for most development and CI scenarios.

```bash
# Run all simple tests
pnpm test:simple test/subscription-simple.test.js

# Or with a specific file
pnpm test:simple test/your-test-file.test.js
```

### Vitest

Vitest is available for more complex testing scenarios. We provide two options:

```bash
# Run Vitest with mocked database (no DB connection needed)
pnpm test:no-db

# Run Vitest with real database connection (requires configured DB)
pnpm test
```

### Mocha

Some legacy tests use Mocha. While we're transitioning to simpler approaches, you can still run Mocha tests:

```bash
# Run all Mocha tests (requires configured DB)
pnpm mocha
```

### Test Configuration

Test files are located in the `packages/backend/test` directory. See the [testing documentation](packages/backend/test/README.md) for detailed information on creating and running tests.

## 🐳 Docker Support

Barkle V4 can be run using Docker for internal development and testing:

1. **Build the Docker image**:
```bash
docker build -t barkle-internal .
```

2. **Run with docker-compose**:
```bash
docker-compose up -d
```

See `docker-README.md` for more details on internal Docker deployment procedures.

## 🔧 Troubleshooting

### Installation Issues

If you encounter dependency installation issues:

1. **Clear pnpm cache and node_modules**:
```bash
pnpm cache clean
rm -rf node_modules
rm -rf packages/*/node_modules
```

2. **Install build dependencies** (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install -y python3 make g++ build-essential
```

3. **Reinstall dependencies**:
```bash
pnpm install
```

### TypeScript ESLint Issues

If you encounter TypeScript ESLint plugin issues:

1. **Ensure consistent versions**:
```bash
pnpm add -D @typescript-eslint/eslint-plugin@5.46.1 @typescript-eslint/parser@5.46.1
```

2. **Clear ESLint cache**:
```bash
rm -rf .eslintcache
```

### Native Module Build Issues

If you encounter issues building native modules (like `gl`, `re2`, etc.):

1. Ensure you have the required build tools installed
2. Try installing with the `--ignore-scripts` flag first:
```bash
pnpm install --ignore-scripts
pnpm rebuild
```

## 🤝 Contributing

We welcome contributions from the community! Please follow these guidelines:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear, descriptive messages
4. Push to your fork and submit a pull request
5. Ensure your code follows the project's style guidelines

## 📚 Documentation

For more detailed documentation on the architecture, API endpoints, and development standards, please refer to the following documents:

- [Architecture Overview](./ARCHITECTURE.md)
- [Style Guide](./BARKLE_STYLE_GUIDE.md)

## 🙏 Credits

Barkle is built upon the foundations of two excellent open-source projects:

- **[Misskey](https://github.com/misskey-dev/misskey)** - The original decentralized social platform (AGPL-3.0)
- **[Calckey](https://codeberg.org/calckey/calckey)** - Enhanced fork of Misskey with additional features (AGPL-3.0)

We are grateful to both development teams and their contributors. This project uses calckey-js for API interactions and incorporates features from both upstream projects.

## 📄 License

GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: https://github.com/BarkleAPP/Barkle-oss
- **Upstream**: [Misskey](https://github.com/misskey-dev/misskey) • [Calckey](https://codeberg.org/calckey/calckey)
