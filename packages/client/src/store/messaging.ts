import { ref, computed } from 'vue';
import { mainRouter } from '@/router';

// Global messaging state
export const isInMessagingMode = ref(false);
export const shouldHideBottomNav = ref(false);

// Computed property to check if we're on a messaging route
export const isMessagingRoute = computed(() => {
  const currentRoute = mainRouter.currentRoute.value;
  return currentRoute.path.startsWith('/my/messaging') ||
    currentRoute.name === 'messaging' ||
    currentRoute.name === 'messageUI' ||
    currentRoute.path.includes('/messaging');
});

// Computed property to check if we should hide bottom nav (only in active conversation)
export const shouldHideBottomNavComputed = computed(() => {
  const currentRoute = mainRouter.currentRoute.value;

  // Only hide bottom nav when actually in a conversation (messageUI route)
  // Show navbar on the main messaging list page (/my/messaging)
  return currentRoute.name === 'messageUI';
});

// Watch route changes and update messaging state
mainRouter.addListener('change', () => {
  const wasInMessaging = isInMessagingMode.value;
  isInMessagingMode.value = isMessagingRoute.value;
  shouldHideBottomNav.value = shouldHideBottomNavComputed.value;

  // Add any additional messaging mode logic here
  if (wasInMessaging !== isInMessagingMode.value) {
    // State changed - could emit events or perform other actions
  }
});

// Initialize state
isInMessagingMode.value = isMessagingRoute.value;
shouldHideBottomNav.value = shouldHideBottomNavComputed.value;

// Export functions to control messaging state
export function enterMessagingMode() {
  isInMessagingMode.value = true;
  shouldHideBottomNav.value = true;
}

export function exitMessagingMode() {
  isInMessagingMode.value = false;
  shouldHideBottomNav.value = false;
}

// Helper function to force update the state (useful for edge cases)
export function updateMessagingState() {
  isInMessagingMode.value = isMessagingRoute.value;
  shouldHideBottomNav.value = shouldHideBottomNavComputed.value;
}