# Barkle V4 Style Guide & Component Library

## 🚨 CRITICAL GLOBAL COMPONENTS RULE 🚨

**NEVER IMPORT GLOBAL COMPONENTS** - Components in `packages/client/src/components/global/` are automatically registered and available everywhere. Just use them directly in templates without import statements. Importing them will cause build errors.

### Global Components (DO NOT IMPORT):
- `MkA` - Link component with routing support
- `MkAcct` - Account display component
- `MkAd` - Advertisement component
- `MkAvatar` - User avatar with decorations and online status
- `MkEllipsis` - Loading ellipsis animation
- `MkEmoji` - Emoji rendering (custom and Unicode)
- `MkError` - Error display component
- `MkLoading` - Loading spinner component
- `MkMisskeyFlavoredMarkdown` - MFM parser and renderer
- `MkPageHeader` - Page header component
- `MkSpacer` - Responsive spacing container
- `MkStickyContainer` - Sticky positioning container
- `MkTime` - Time display with relative/absolute modes
- `MkUrl` - URL preview component
- `MkUserName` - User name display with decorations
- `RouterView` - Vue router view wrapper

### ❌ WRONG:
```vue
<script setup>
import MkAvatar from '@/components/MkAvatar.vue';
import MkSpacer from '@/components/global/MkSpacer.vue';
</script>
```

### ✅ CORRECT:
```vue
<template>
  <MkSpacer>
    <MkAvatar :user="user" />
    <MkTime :time="createdAt" />
  </MkSpacer>
</template>
<!-- No imports needed for global components! -->
```

## Component Naming Conventions

### Prefixes
- **Mk**: Core Misskey/Calckey components (e.g., `MkButton`, `MkNote`, `MkTimeline`)
- **Bk**: Barkle-specific components (e.g., `BkLive`, `BkGifPicker`)
- **Form**: Form-related components in `form/` directory

### File Naming
- **PascalCase**: All Vue components use PascalCase (e.g., `MkButton.vue`)
- **kebab-case**: Directories and non-component files use kebab-case
- **Descriptive**: Component names should clearly indicate their purpose

## Core UI Components

### Layout & Structure

#### MkSpacer
Responsive spacing container with automatic margin adjustment.
```vue
<MkSpacer :contentMax="600" :marginMin="12" :marginMax="24">
  <div>Content with responsive margins</div>
</MkSpacer>
```

**Props:**
- `contentMax?: number` - Maximum content width
- `marginMin?: number` - Minimum margin (default: 12)
- `marginMax?: number` - Maximum margin (default: 24)

#### MkContainer
Collapsible container with header and content sections.
```vue
<MkContainer :showHeader="true" :foldable="true" :thin="false">
  <template #header>Container Title</template>
  <template #func>
    <button>Action</button>
  </template>
  <div>Container content</div>
</MkContainer>
```

**Props:**
- `showHeader?: boolean` - Show header section
- `thin?: boolean` - Compact styling
- `naked?: boolean` - Remove background/borders
- `foldable?: boolean` - Allow collapse/expand
- `expanded?: boolean` - Initial expanded state
- `scrollable?: boolean` - Enable scrolling
- `maxHeight?: number` - Maximum height before truncation

### Interactive Elements

#### MkButton
Primary button component with ripple effects and variants.
```vue
<MkButton 
  :primary="true" 
  :rounded="false" 
  :danger="false"
  @click="handleClick"
>
  Button Text
</MkButton>
```

**Props:**
- `type?: 'button' | 'submit' | 'reset'`
- `primary?: boolean` - Primary styling
- `gradate?: boolean` - Gradient background
- `rounded?: boolean` - Rounded corners
- `inline?: boolean` - Inline display
- `link?: boolean` - Render as link
- `to?: string` - Link destination
- `danger?: boolean` - Danger styling
- `full?: boolean` - Full width

### User Interface

#### MkAvatar
User avatar with decorations, online status, and cat ears.
```vue
<MkAvatar 
  :user="user" 
  :showIndicator="true"
  :disableLink="false"
  :disablePreview="false"
/>
```

**Props:**
- `user: User` - User object (required)
- `target?: string` - Link target
- `disableLink?: boolean` - Disable user profile link
- `disablePreview?: boolean` - Disable hover preview
- `showIndicator?: boolean` - Show online status
- `decorations?: UserDecoration[]` - Avatar decorations
- `disableDecorations?: boolean` - Hide decorations

**Features:**
- Automatic cat ears for cat users
- Live streaming indicator with pulse animation
- Avatar decorations with positioning
- Online status indicator
- Hover animations

#### MkEmoji
Emoji rendering component supporting custom and Unicode emojis.
```vue
<MkEmoji 
  :emoji="':custom_emoji:'" 
  :normal="false"
  :isReaction="false"
/>
```

**Props:**
- `emoji: string` - Emoji code or Unicode character
- `normal?: boolean` - Normal size (no hover effects)
- `noStyle?: boolean` - Remove default styling
- `customEmojis?: CustomEmoji[]` - Custom emoji definitions
- `isReaction?: boolean` - Reaction context styling

#### MkTime
Time display with multiple formatting modes.
```vue
<MkTime 
  :time="new Date()" 
  mode="relative"
/>
```

**Props:**
- `time: Date | string` - Time to display
- `mode?: 'relative' | 'absolute' | 'detail'` - Display format

**Modes:**
- `relative`: "2 hours ago", "just now"
- `absolute`: Full date/time string
- `detail`: "2023-10-15 14:30 (2 hours ago)"

## Form Components

### FormInput
Enhanced input field with validation and styling.
```vue
<FormInput
  v-model="value"
  type="text"
  :required="true"
  :disabled="false"
  placeholder="Enter text..."
>
  <template #label>Field Label</template>
  <template #prefix><i class="icon"></i></template>
  <template #suffix>@domain.com</template>
  <template #caption>Help text</template>
</FormInput>
```

**Props:**
- `modelValue: string | number`
- `type?: 'text' | 'number' | 'password' | 'email' | 'url' | 'date' | 'time' | 'search'`
- `required?: boolean`
- `readonly?: boolean`
- `disabled?: boolean`
- `pattern?: string`
- `placeholder?: string`
- `autofocus?: boolean`
- `autocomplete?: boolean`
- `spellcheck?: boolean`
- `step?: any`
- `datalist?: string[]`
- `inline?: boolean`
- `debounce?: boolean`
- `manualSave?: boolean`
- `small?: boolean`
- `large?: boolean`

### Other Form Components
- `FormCheckbox` - Checkbox input
- `FormRadio` - Radio button
- `FormRadios` - Radio button group
- `FormSelect` - Dropdown select
- `FormTextarea` - Multi-line text input
- `FormRange` - Range slider
- `FormSwitch` - Toggle switch
- `FormSection` - Form section grouping
- `FormFolder` - Collapsible form section
- `FormInfo` - Information display
- `FormLink` - Form navigation link
- `FormSlot` - Custom form content
- `FormSplit` - Split layout
- `FormSuspense` - Async form loading

## Barkle-Specific Components

### BkLive
Live streaming component with real-time features.

### BkGifPicker / BkGifPickerDialog
GIF selection interface for posts and messages.

### BkHorizontalChannelList / BkHorizontalUserList
Horizontal scrolling lists for channels and users.

### BkMakeAlt / BkMakeAltDialog
Alternative text creation for accessibility.

### BkOAuthAppDetailsDialog
OAuth application management interface.

## Growth & Engagement Components

### Growth Components (`packages/client/src/components/growth/`)
- `ActivityIndicator` - User activity visualization
- `FollowSuggestions` - Suggested users to follow
- `GrowthDashboard` - Analytics dashboard
- `InvitationAnalytics` - Invitation tracking
- `InviteFriends` - Friend invitation interface
- `MilestoneCelebration` - Achievement celebrations
- `OnboardingComplete` - Onboarding completion
- `PositiveFeedback` - Positive reinforcement UI
- `SocialProofIndicator` - Social proof elements

## Messaging Components

### Modern Messaging (`packages/client/src/components/messaging/`)
- `ModernChatList` - Chat list interface
- `ModernChatView` - Chat conversation view
- `ModernMessageBubble` - Individual message display
- `ModernMessageComposer` - Message composition interface
- `ChatList` - Legacy chat list
- `ChatView` - Legacy chat view
- `MessageBubble` - Legacy message bubble
- `MessageComposer` - Legacy message composer
- `MessageFile` - File message display

## Privacy Components

### CookieConsent
GDPR-compliant cookie consent management.

## Design System

### Color Palette
The theme system uses CSS custom properties with light/dark variants:

#### Primary Colors
- `--accent`: Primary brand color (#86b300)
- `--bg`: Background color
- `--fg`: Foreground/text color
- `--panel`: Panel background
- `--divider`: Border/divider color

#### Interactive States
- `--buttonBg`: Button background
- `--buttonHoverBg`: Button hover state
- `--inputBorder`: Input border color
- `--inputBorderHover`: Input hover border
- `--focus`: Focus indicator color

#### Semantic Colors
- `--success`: Success state (#86b300)
- `--error`: Error state (#ec4137)
- `--warn`: Warning state (#ecb637)
- `--info`: Information state

#### Transparency Variants
- `--fgTransparent`: 50% opacity text
- `--fgTransparentWeak`: 75% opacity text
- `--acrylicBg`: Semi-transparent background

### Typography
- **Font Family**: System font stack
- **Font Sizes**: Relative em units for scalability
- **Line Height**: 1.4em for readability
- **Font Weight**: Normal (400) and bold (700) variants

### Spacing
- **Base Unit**: 8px grid system
- **Component Padding**: 8px, 12px, 16px, 24px
- **Margins**: Responsive based on screen size
- **Border Radius**: 5px standard, 999px for pills

### Animations
- **Transitions**: 0.1s to 0.5s ease timing
- **Hover Effects**: Scale, opacity, color changes
- **Loading States**: Spinner, ellipsis, skeleton
- **Page Transitions**: Slide, fade effects

## Internationalization (i18n)

### Usage Pattern
```vue
<script setup>
import { i18n } from '@/i18n';
</script>

<template>
  <div>{{ i18n.ts.buttonText }}</div>
  <div>{{ i18n.t('dynamicKey', { param: value }) }}</div>
</template>
```

### Key Structure
- `i18n.ts.key` - Static translations
- `i18n.t('key', params)` - Dynamic translations with parameters
- Nested keys use dot notation: `i18n.ts._ago.justNow`

## Best Practices

### Component Development
1. **Use Composition API** - Prefer `<script setup>` syntax
2. **TypeScript First** - All components should be fully typed
3. **Responsive Design** - Components should work on all screen sizes
4. **Accessibility** - Include proper ARIA labels and keyboard navigation
5. **Performance** - Use `v-memo` and `v-once` for optimization
6. **Consistent Naming** - Follow established naming conventions

### Styling Guidelines
1. **Scoped Styles** - Use `<style scoped>` or CSS modules
2. **CSS Custom Properties** - Use theme variables for colors
3. **Mobile First** - Design for mobile, enhance for desktop
4. **Dark Mode Support** - Ensure components work in both themes
5. **Animation Performance** - Use transform and opacity for animations

### State Management
1. **Local State** - Use `ref()` and `reactive()` for component state
2. **Global State** - Use Pinia stores for shared state
3. **Props Down, Events Up** - Follow Vue's data flow patterns
4. **Computed Properties** - Use for derived state

### Error Handling
1. **Graceful Degradation** - Components should handle missing data
2. **Loading States** - Show appropriate loading indicators
3. **Error Boundaries** - Use error handling for async operations
4. **User Feedback** - Provide clear error messages

## File Organization

```
packages/client/src/components/
├── global/           # Auto-registered global components (DO NOT IMPORT)
├── form/            # Form input components
├── growth/          # User growth and engagement
├── messaging/       # Chat and messaging
├── privacy/         # Privacy and compliance
├── page/           # Page builder components
├── MkButton.vue    # Core UI components
├── MkContainer.vue
├── MkNote.vue
└── ...
```

## Migration Notes

When updating or creating components:

1. **Check Global Registry** - Verify if component should be global
2. **Follow Naming** - Use appropriate Mk/Bk prefixes
3. **TypeScript Types** - Define proper prop and emit types
4. **Theme Support** - Use CSS custom properties
5. **i18n Support** - Include internationalization
6. **Accessibility** - Add ARIA attributes and keyboard support
7. **Documentation** - Update this guide with new components

## Common Patterns

### Component Template
```vue
<template>
  <div class="component-name" :class="{ active, disabled }">
    <slot name="header"></slot>
    <div class="content">
      <slot></slot>
    </div>
    <slot name="footer"></slot>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';

interface Props {
  active?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  disabled: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
  change: [value: string];
}>();

// Component logic here
</script>

<style lang="scss" scoped>
.component-name {
  // Styles here using theme variables
  background: var(--panel);
  color: var(--fg);
  border-radius: 6px;
  
  &.active {
    background: var(--accent);
    color: var(--fgOnAccent);
  }
  
  &.disabled {
    opacity: 0.7;
    pointer-events: none;
  }
}
</style>
```

This style guide should be referenced for all component development and updates in Barkle V4.