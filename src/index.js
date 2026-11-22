/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { ConfigurationController } from './controller/configurationController.js';
import { InventoryController } from './controller/inventoryController.js';
import { LayoutController } from './controller/layoutController.js';
import { AccountMenuController } from './controller/accountMenuController.js';
import { AuthenticationManager } from './controller/authenticationController.js';
import { takePendingPreservation } from './utils/preservationKeys.js';
// eslint-disable-next-line object-curly-newline
import { Application, Assets, Color, path } from './pixi.mjs';

// The subscription dialog is only opened at startup by the ?subscribe=true deep
// link or by a pendingSubscribe intent left behind by an earlier visit, and both
// are readable synchronously. Start the fetch here rather than importing the
// module statically: a visitor who is not entering the subscribe flow never
// downloads it at all, while one who is gets the whole startup sequence -- Pixi
// init, the manifest fetch, layoutController.init(), the Cognito round-trip --
// to cover the request. That matters because the signed-out branch at the bottom
// of this file shows the dialog with no await in front of it, so a cold fetch
// there would stall someone who arrived ready to pay.
const loadParams = new URLSearchParams(window.location.search);
const hasSubscribeParam = loadParams.get('subscribe') === 'true';
let wantsSubscribeDialog = hasSubscribeParam;
if (!wantsSubscribeDialog) {
  try {
    wantsSubscribeDialog = sessionStorage.getItem('pendingSubscribe') === 'true';
  } catch (error) {
    // Web Storage access itself throws in some privacy modes, and this runs
    // before anything else. The URL alone decides when it does.
  }
}
// Settles to null rather than rejecting: left unhandled until the await far
// below, a failed fetch would be reported as an unhandled rejection and then
// abort startup with the loading overlay still up.
const subscriptionDialogReady = wantsSubscribeDialog
  ? import('./controller/subscriptionDialogController.js').catch((error) => {
    console.error('Failed to load the subscription dialog:', error);
    return null;
  })
  : null;

const canvasContainer = document.getElementById('canvasContainer');
document.body.style.setProperty('--canvas-bg', '#93bee2');
const app = new Application();
await app.init({ background: '#93bee2', resizeTo: canvasContainer, resolution: window.devicePixelRatio ?? 1 });
canvasContainer.appendChild(app.canvas);
await Assets.init({ basePath: '/img/', manifest: path.toAbsolute('../data/manifest.json') });
window.app = app;
window.assets = Assets;
Color.prototype.toYiq = function () {
  return ((this._components[0] * 299 + this._components[1] * 587 + this._components[2] * 114) / 1000) * 255;
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
  ).addEventListener('change', onChange, { once: true });
}
listenOnDevicePixelRatio();
const layoutController = LayoutController.getInstance(app);
await layoutController.init();
layoutController.initWindowEvents();
new ConfigurationController(); // eslint-disable-line no-new
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

// Custom MOCs are available to every signed-in user, subscription or not.
// Startup is not blocked on it, but the promise is held: a preserved layout can
// place cloud MOCs, and restoring it before their tracks are registered would
// leave those components unable to resolve their alias. The restore below only
// waits on it when the layout names a MOC that is not registered yet.
const cloudMocsReady = authManager.isAuthenticated
  ? layoutController.loadCloudMocs() : Promise.resolve();

// Update cloud menu visibility based on authentication state
await layoutController.updateCloudMenuVisibility();

// A layout left behind by a reload out of the editor or by a trip to Stripe
// Checkout is restored here, while the loading overlay is still up, so the user
// never sees an empty workspace that then fills in. Only that layout's own
// assets are waited for, and the cloud MOC list only if it names a MOC that is
// not registered yet.
if (!layoutController.readOnly) {
  let pendingRestore = null;
  try {
    pendingRestore = takePendingPreservation(window.location.search, {
      session: sessionStorage,
      local: localStorage,
    });
  } catch (error) {
    // Web Storage access itself throws in some privacy modes; nothing to restore.
  }
  if (pendingRestore) {
    try {
      const { restorePendingLayout } = await import('./utils/layoutPreservation.js');
      await restorePendingLayout(pendingRestore, { cloudMocsReady });
    } catch (error) {
      console.error('Failed to restore the preserved layout:', error);
    }
  }
}

// Detect Stripe Checkout or Portal return flow via URL query parameters
const checkoutParams = new URLSearchParams(window.location.search);
const checkoutSessionId = checkoutParams.get('session_id');
const checkoutCancelled = checkoutParams.get('checkout');
const portalReturn = checkoutParams.get('portal_return');

if (checkoutSessionId || checkoutCancelled === 'cancelled' || portalReturn === 'true') {
  // Dynamically import SubscriptionService only for checkout/portal return flows
  import('./cloud/subscriptionService.js').then(async ({ SubscriptionService }) => {
    // Not waiting on cloudMocsReady: the preserved layout was restored above,
    // so the restore these handlers attempt finds nothing left to do.
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

// Handle subscribe deep link: ?subscribe=true or pending intent from sessionStorage.
// Both were read at the top of this file, which is also what decided whether to
// prefetch the dialog, so the decision and the fetch cannot disagree.
if (wantsSubscribeDialog) {
  if (hasSubscribeParam) {
    const cleanUrl = new URL(window.location);
    cleanUrl.searchParams.delete('subscribe');
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);
  }
  // Non-null exactly when wantsSubscribeDialog is true: the two are set together.
  // The module itself is null when it failed to load, which was already logged.
  const SubscriptionDialogController = (await subscriptionDialogReady)
    ?.SubscriptionDialogController;
  if (SubscriptionDialogController && authManager.isAuthenticated) {
    const hasAccess = await authManager.hasFeatureAccess('subscription');
    if (!hasAccess) {
      SubscriptionDialogController.getInstance().show('Choose a plan to get started.');
    } else {
      sessionStorage.removeItem('pendingSubscribe');
    }
  } else if (SubscriptionDialogController) {
    sessionStorage.setItem('pendingSubscribe', 'true');
    SubscriptionDialogController.getInstance()
      .show('Sign in or create an account to subscribe.', 'Get Started');
  }
}

document.getElementById('apploading').remove();
