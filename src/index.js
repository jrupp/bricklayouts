import { ConfigurationController } from './controller/configurationController.js';
import { InventoryController } from './controller/inventoryController.js';
import { LayoutController } from './controller/layoutController.js';
import { AccountMenuController } from './controller/accountMenuController.js';
import { SubscriptionDialogController } from './controller/subscriptionDialogController.js';
import { AuthenticationManager } from './controller/authenticationController.js';
import { Application, Assets, Color, path } from './pixi.mjs';

const canvasContainer = document.getElementById('canvasContainer');
document.body.style.setProperty('--canvas-bg', '#93bee2');
const app = new Application();
await app.init({ background: '#93bee2', resizeTo: canvasContainer, resolution: window.devicePixelRatio ?? 1 });
canvasContainer.appendChild(app.canvas);
await Assets.init({ basePath: '/img/', manifest: path.toAbsolute('../data/manifest.json') });
window.app = app;
window.assets = Assets;
Color.prototype.toYiq = function () {
  return ((this._components[0] * 299 + this._components[1] * 587 + this._components[2] * 114) /  1000) * 255;
};
// Fallback UI function if CDN libraries are blocked
if (typeof window.ui !== 'function') {
  window.ui = function (...args) {
    if (args.length > 0) {
      console.warn('BeerCSS.js failed to load - CDN may be blocked:', args);
    }
  };
}
function listenOnDevicePixelRatio() {
  function onChange() {
    window.app.renderer.resolution = window.devicePixelRatio;
    listenOnDevicePixelRatio();
  }
  matchMedia(
    `(resolution: ${window.devicePixelRatio}dppx)`
  ).addEventListener("change", onChange, { once: true });
}
listenOnDevicePixelRatio();
const layoutController = LayoutController.getInstance(app);
await layoutController.init();
layoutController.initWindowEvents();
new ConfigurationController();
InventoryController.getInstance();

// Initialize authentication using singleton pattern
// PUBLIC authentication UI (AccountMenu, AuthenticationModal) is imported directly
// without auth checks, as they are needed for login/signup options
const authManager = AuthenticationManager.getInstance();
await authManager.initialize();
AccountMenuController.initialize(authManager);

// Load private cloud features if user is already authenticated with cloud access
// This handles the case where user refreshes the page while logged in
if (authManager.isAuthenticated && authManager.hasCloudAccess) {
  await authManager.loadPrivateCloudFeatures();
}

// Update cloud menu visibility based on authentication state
await layoutController.updateCloudMenuVisibility();

// Detect Stripe Checkout or Portal return flow via URL query parameters
const checkoutParams = new URLSearchParams(window.location.search);
const checkoutSessionId = checkoutParams.get('session_id');
const checkoutCancelled = checkoutParams.get('checkout');
const portalReturn = checkoutParams.get('portal_return');

if (checkoutSessionId || checkoutCancelled === 'cancelled' || portalReturn === 'true') {
  // Dynamically import SubscriptionService only for checkout/portal return flows
  import('./cloud/subscriptionService.js').then(async ({ SubscriptionService }) => {
    const subscriptionService = new SubscriptionService(authManager);
    try {
      if (checkoutSessionId) {
        await subscriptionService.handleSuccessReturn(checkoutSessionId);
      } else if (portalReturn === 'true') {
        await subscriptionService.handlePortalReturn();
      } else {
        await subscriptionService.handleCancelReturn();
      }
    } catch (error) {
      console.error('Error handling checkout/portal return:', error);
    }
  }).catch((error) => {
    console.error('Failed to load SubscriptionService for return flow:', error);
  });
} else if (authManager.isAuthenticated && authManager.hasCloudAccess) {
  authManager.refreshSession();
}

// Handle subscribe deep link: ?subscribe=true or pending intent from sessionStorage
const subscribeParam = checkoutParams.get('subscribe');
const pendingSubscribe = sessionStorage.getItem('pendingSubscribe');

if (subscribeParam === 'true' || pendingSubscribe === 'true') {
  if (subscribeParam === 'true') {
    const cleanUrl = new URL(window.location);
    cleanUrl.searchParams.delete('subscribe');
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);
  }
  if (authManager.isAuthenticated) {
    const hasAccess = await authManager.hasFeatureAccess('subscription');
    if (!hasAccess) {
      SubscriptionDialogController.getInstance().show('Choose a plan to get started.');
    } else {
      sessionStorage.removeItem('pendingSubscribe');
    }
  } else {
    sessionStorage.setItem('pendingSubscribe', 'true');
    SubscriptionDialogController.getInstance().show('Sign in or create an account to subscribe.', 'Get Started');
  }
}

document.getElementById('apploading').remove();
