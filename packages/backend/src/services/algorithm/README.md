# ⚠️ ALGORITHM SERVICES - READ THIS FIRST! ⚠️

## 🚨 CRITICAL RULE: NO NEW ALGORITHM FILES HERE! 🚨

**This directory should ONLY contain backend-specific integration code.**

### ✅ ALLOWED Files (Backend-Specific Services):
- `algorithm-microservice-client.ts` - Main integration client
- `ab-testing-service.ts` - A/B testing
- `signal-collection-service.ts` - Signal collection & storage
- `advanced-sentiment-analysis.ts` - Sentiment analysis
- `behavioral-pattern-recognition.ts` - Pattern recognition
- `timeline-mixer-service.ts` - Timeline mixing
- `user-personalization-service.ts` - User personalization
- `light-ranker-service.ts` - Fast pre-filtering
- `microservice-bridge.ts` - Temporary bridge to algorithm package

### ❌ FORBIDDEN - These belong in `packages/algorithm/`:
- Ranking algorithms (monolith-inspired-ranker, etc.)
- Timeline generation (scalable-timeline-service)
- Diversity engines (diversification-engine, diversity-injection-service)
- User tracking (user-signal-tracker, enhanced-tracking-service)
- Cache systems (cache-invalidation-hooks)
- ML/embedding systems
- ANY core algorithm logic

## 📦 Where Code Should Live

### `packages/algorithm/` (Microservice - Source of Truth)
**Purpose**: Pure algorithm logic, ML models, ranking, diversity

```
packages/algorithm/src/
├── ranker/              # ML ranking algorithms
├── timeline/            # Timeline generation
├── diversity/           # Content diversity
├── tracking/            # User behavior tracking
├── cache/               # Cache management
├── embeddings/          # Embedding tables
├── learning/            # Real-time learning
└── scaling/             # Performance optimization
```

### `packages/backend/src/services/algorithm/` (Integration Layer)
**Purpose**: Connect algorithm microservice to backend (DB, API, queue)

```
packages/backend/src/services/algorithm/
├── algorithm-microservice-client.ts  # Main integration client
├── ab-testing-service.ts              # A/B test management
├── signal-collection-service.ts       # Store signals in DB
├── timeline-mixer-service.ts          # Mix timelines
├── light-ranker-service.ts            # Fast pre-filter
└── microservice-bridge.ts             # Temporary bridge
```

## 🔧 How to Add New Algorithm Features

### 1. Create in Microservice First
```bash
# ✅ CORRECT
packages/algorithm/src/your-feature/new-algorithm.ts

# ❌ WRONG
packages/backend/src/services/algorithm/new-algorithm.ts
```

### 2. Export from Microservice
```typescript
// packages/algorithm/src/index.ts
export { NewAlgorithm } from './your-feature/new-algorithm.js';
```

### 3. Use via Bridge in Backend
```typescript
// packages/backend/src/services/algorithm/your-integration.ts
import { NewAlgorithm } from './microservice-bridge.js';

// Use it with backend-specific data (DB, queue, etc.)
```

## 🛡️ Safeguards

### Before Creating a File Here:

1. **Ask yourself**: "Does this need database access, queue processing, or backend-specific features?"
   - **YES** → Belongs here (integration layer)
   - **NO** → Belongs in `packages/algorithm/` (microservice)

2. **Is this pure algorithm logic?**
   - **YES** → Move to `packages/algorithm/`
   - **NO** → Can stay here

3. **Would this file work standalone without backend dependencies?**
   - **YES** → Move to `packages/algorithm/`
   - **NO** → Can stay here

### Examples:

**✅ Backend-Specific (Belongs Here)**:
- Storing signals in PostgreSQL
- Managing A/B test assignments
- Sending events to Bull queue
- Fetching user data from DB for personalization

**❌ Pure Algorithm (Move to Microservice)**:
- ML model inference
- Ranking score calculation
- Diversity algorithms
- Embedding table management
- Content quality assessment

## 📝 Migration Checklist

If you accidentally created algo code in backend:

- [ ] Move file to `packages/algorithm/src/appropriate-folder/`
- [ ] Update `packages/algorithm/src/index.ts` to export it
- [ ] Update `microservice-bridge.ts` to re-export if needed by backend
- [ ] Update all imports to use `./microservice-bridge.js`
- [ ] Test that everything still works
- [ ] Delete the old file from backend

## 🎯 Current State

**Cleaned up**: 2025-10-28
- Removed 6 duplicate algorithm files from backend
- Enhanced tracking moved to microservice
- Bridge created for temporary cross-package access

**TODO**: 
- Add `@barkle/algorithm` as proper dependency in backend
- Remove `microservice-bridge.ts` once dependency is set up
- Update all imports to use `@barkle/algorithm` directly

---

**Remember**: When in doubt, ask "Is this pure algorithm logic?" If yes, it belongs in the microservice!
