/**
 * SubscriptionDialogController - Controller for the subscription dialog.
 * Displays subscription plan options and initiates the Stripe Checkout flow.
 * Uses singleton pattern - only one instance exists.
 * Follows AirBNB JavaScript style guide.
 */

import { showSnackbar } from '../utils/snackbar.js';

/**
 * Hardcoded subscription plan definitions.
 * The backend maps plan identifiers to Stripe Price IDs server-side.
 */
const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Design, save & print 1 layout',
      'Detailed parts list with purchase links',
      '24/7 access to tutorials & support resources',
    ],
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 7,
    annualPrice: 70,
    features: [
      'Unlimited cloud layouts',
      'Publish to community gallery',
      'Detailed parts list with purchase links',
      '24/7 access to tutorials & support resources',
    ],
    recommended: true,
  },
];

/**
 * Singleton instance
 */
let instance = null;

class SubscriptionDialogController {
  /**
   * Gets the singleton instance of SubscriptionDialogController.
   * @returns {SubscriptionDialogController} The singleton instance
   */
  static getInstance() {
    if (!instance) {
      instance = new SubscriptionDialogController();
    }
    return instance;
  }

  constructor() {
    if (instance !== null) {
      throw new Error('Use SubscriptionDialogController.getInstance() instead of new.');
    }
    this.dialogElement = document.getElementById('subscriptionDialog');
    this.titleElement = this.dialogElement.querySelector('h6');
    this.messageElement = document.getElementById('subscriptionDialogMessage');
    this.signInPrompt = document.getElementById('subscriptionSignInPrompt');
    this.verifyEmailPrompt = document.getElementById('subscriptionVerifyEmailPrompt');
    this.plansSection = document.getElementById('subscriptionPlansSection');
    this.proPrice = document.getElementById('subscriptionProPrice');
    this.proInterval = document.getElementById('subscriptionProInterval');
    this.proAnnualNote = document.getElementById('subscriptionProAnnualNote');
    this.proSubscribeBtn = document.getElementById('subscriptionProSubscribeBtn');
    this.monthlyBtn = document.getElementById('subscriptionMonthlyBtn');
    this.annualBtn = document.getElementById('subscriptionAnnualBtn');
    this.freePlanCard = document.getElementById('subscriptionFreePlan');

    this._selectedInterval = 'month';
    this._transitioning = false;
    this._attachListeners();
    this._attachCloseHandler();
  }

  /**
   * Attaches event listeners to dialog elements.
   * @private
   */
  _attachListeners() {
    if (this.proSubscribeBtn) {
      this.proSubscribeBtn.addEventListener('click', () => {
        this._onPlanSelect('pro', this._selectedInterval);
      });
    }

    if (this.monthlyBtn) {
      this.monthlyBtn.addEventListener('click', () => {
        this._setInterval('month');
      });
    }

    if (this.annualBtn) {
      this.annualBtn.addEventListener('click', () => {
        this._setInterval('year');
      });
    }

    const signInBtn = document.getElementById('subscriptionSignInButton');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        this._handleSignIn();
      });
    }

    const signUpBtn = document.getElementById('subscriptionSignUpButton');
    if (signUpBtn) {
      signUpBtn.addEventListener('click', () => {
        this._handleSignUp();
      });
    }

    const verifyEmailBtn = document.getElementById('subscriptionVerifyEmailButton');
    if (verifyEmailBtn) {
      verifyEmailBtn.addEventListener('click', () => {
        this._handleVerifyEmail();
      });
    }
  }

  /**
   * Attaches a close event handler to the dialog to clear pending subscribe
   * intent when the user intentionally dismisses the dialog (X button).
   * Programmatic closes (transitioning to auth modal) set _transitioning=true
   * to prevent clearing the intent.
   * @private
   */
  _attachCloseHandler() {
    if (this._closeHandler && this._closeHandlerTarget) {
      this._closeHandlerTarget.removeEventListener('close', this._closeHandler);
    }
    if (this.dialogElement) {
      this._closeHandler = () => {
        if (!this._transitioning) {
          sessionStorage.removeItem('pendingSubscribe');
        }
        this._transitioning = false;
      };
      this._closeHandlerTarget = this.dialogElement;
      this.dialogElement.addEventListener('close', this._closeHandler);
    }
  }

  /**
   * Updates the billing interval toggle and price display.
   * @param {string} interval - "month" or "year"
   * @private
   */
  _setInterval(interval) {
    this._selectedInterval = interval;
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro');

    if (interval === 'month') {
      this.monthlyBtn?.classList.add('active');
      this.annualBtn?.classList.remove('active');
      if (this.proPrice) this.proPrice.textContent = `${proPlan.monthlyPrice}`;
      if (this.proInterval) this.proInterval.textContent = '/month';
      if (this.proAnnualNote) {
        this.proAnnualNote.parentElement.classList.add('hidden');
        this.proAnnualNote.textContent = '';
      }
    } else {
      this.annualBtn?.classList.add('active');
      this.monthlyBtn?.classList.remove('active');
      if (this.proPrice) this.proPrice.textContent = `${proPlan.annualPrice}`;
      if (this.proInterval) this.proInterval.textContent = '/year';
      if (this.proAnnualNote) {
        this.proAnnualNote.parentElement.classList.remove('hidden');
        this.proAnnualNote.textContent = `$${(proPlan.annualPrice / 12).toFixed(2)}/mo`;
      }
    }
  }

  /**
   * Shows the subscription dialog with an optional custom message.
   * Dynamically sets the current plan indicator based on user's subscription group.
   * Shows sign-in prompt for unauthenticated users.
   * @param {string} [message] - Optional message to display at the top of the dialog.
   * @param {string} [title] - Optional title to display at the top of the dialog.
   */
  async show(message, title) {
    if (message !== undefined && this.messageElement) {
      this.messageElement.textContent = message;
    }

    if (title !== undefined && this.titleElement) {
      this.titleElement.textContent = title;
    } else {
      this.titleElement.textContent = 'Subscription Plans';
    }

    const authManager = await this._getAuthManager();

    if (!authManager || !authManager.isAuthenticated) {
      // Show sign-in prompt, hide plans and verify email
      this.signInPrompt?.classList.remove('hidden');
      this.plansSection?.classList.add('hidden');
      this.verifyEmailPrompt?.classList.add('hidden');
      this.dialogElement?.setAttribute('data-view', 'signin');
    } else {
      const emailVerified = await authManager.getEmailVerified();
      if (!emailVerified) {
        // Show verify email prompt, hide sign-in and plans
        this.signInPrompt?.classList.add('hidden');
        this.plansSection?.classList.add('hidden');
        this.verifyEmailPrompt?.classList.remove('hidden');
        this.dialogElement?.setAttribute('data-view', 'verify');
      } else {
        // Show plans, hide sign-in and verify email
        this.signInPrompt?.classList.add('hidden');
        this.verifyEmailPrompt?.classList.add('hidden');
        this.plansSection?.classList.remove('hidden');
        this.dialogElement?.setAttribute('data-view', 'plans');

        // Update current plan indicator
        await this._updateCurrentPlanIndicator(authManager);
      }
    }

    ui('#subscriptionDialog');
  }

  /**
   * Updates the "Current plan" text on the appropriate plan card.
   * @param {Object} authManager - The AuthenticationManager instance
   * @private
   */
  async _updateCurrentPlanIndicator(authManager) {
    const groups = await authManager.getUserGroups();
    const isSubscriber = groups.includes('subscription') || groups.includes('admin');

    const freeStatus = this.freePlanCard?.querySelector('p.small-text');
    if (freeStatus) {
      freeStatus.textContent = isSubscriber ? '' : 'Current plan';
    }

    if (this.proSubscribeBtn) {
      if (isSubscriber) {
        this.proSubscribeBtn.textContent = 'Current plan';
        this.proSubscribeBtn.disabled = true;
      } else {
        this.proSubscribeBtn.textContent = 'Upgrade';
        this.proSubscribeBtn.disabled = false;
      }
    }
  }

  /**
   * Handles plan selection by dynamically importing SubscriptionService
   * and initiating the checkout flow.
   * @param {string} planId - Plan identifier (e.g., "pro")
   * @param {string} interval - Billing interval ("month" or "year")
   * @private
   */
  async _onPlanSelect(planId, interval) {
    sessionStorage.removeItem('pendingSubscribe');

    if (this.proSubscribeBtn) {
      this.proSubscribeBtn.disabled = true;
      this.proSubscribeBtn.innerHTML = '<progress class="circle small"></progress>';
    }

    try {
      const authManager = await this._getAuthManager();
      if (!authManager || !authManager.isAuthenticated) {
        this._handleSignIn();
        return;
      }

      const { SubscriptionService } = await import('../cloud/subscriptionService.js');
      const subscriptionService = new SubscriptionService(authManager);
      await subscriptionService.initiateCheckout(planId, interval);
    } catch (error) {
      console.error('Checkout initiation failed:', error);
      showSnackbar(
        error.message || 'Unable to start checkout. Please try again.',
        'error'
      );
    } finally {
      // Restore button state in case redirect was blocked or error occurred
      if (this.proSubscribeBtn) {
        this.proSubscribeBtn.disabled = false;
        this.proSubscribeBtn.textContent = 'Upgrade';
      }
    }
  }

  /**
   * Handles sign-in button click by opening the authentication modal.
   * Sets transitioning flag to prevent the close handler from clearing
   * the pending subscribe intent.
   * @private
   */
  async _handleSignIn() {
    try {
      this._transitioning = true;
      ui('#subscriptionDialog'); // Close subscription dialog
      const module = await import('../public-cloud/authenticationModal.js');
      const authManager = await this._getAuthManager();
      const modal = module.AuthenticationModal.getInstance(authManager);
      modal.show('login', () => this._checkPendingSubscribe());
    } catch (error) {
      console.error('Failed to open sign-in modal:', error);
    }
  }

  /**
   * Handles sign-up button click by opening the authentication modal
   * in signup mode. Sets transitioning flag to prevent the close handler
   * from clearing the pending subscribe intent.
   * @private
   */
  async _handleSignUp() {
    try {
      this._transitioning = true;
      ui('#subscriptionDialog'); // Close subscription dialog
      const module = await import('../public-cloud/authenticationModal.js');
      const authManager = await this._getAuthManager();
      const modal = module.AuthenticationModal.getInstance(authManager);
      modal.show('signup', () => this._checkPendingSubscribe());
    } catch (error) {
      console.error('Failed to open sign-up modal:', error);
    }
  }

  /**
   * Handles verify email button click by opening ProfileModal
   * to the email verification view.
   * @private
   */
  async _handleVerifyEmail() {
    try {
      ui('#subscriptionDialog');
      const authManager = await this._getAuthManager();
      const { ProfileModal } = await import('../cloud/profileModal.js');
      const modal = ProfileModal.getInstance(authManager);
      modal.showVerifyEmail(() => this._checkPendingSubscribe());
    } catch (error) {
      console.error('Failed to open email verification:', error);
    }
  }

  /**
   * Checks if the user completed authentication after the auth modal closes.
   * If authenticated, and not already subscribed, re-shows the
   * subscription dialog with plans. If not authenticated, clears the intent
   * since the user intentionally closed the auth modal.
   * @private
   */
  async _checkPendingSubscribe() {
    const authManager = await this._getAuthManager();
    if (authManager && authManager.isAuthenticated) {
      try {
        const { AccountMenuController } = await import('./accountMenuController.js');
        AccountMenuController.getInstance().handlePostLoginUpdates();
      } catch (error) {
        console.error('Failed to update menu state after login:', error);
      }

      const groups = await authManager.getUserGroups();
      if (!groups.includes('subscription') && !groups.includes('admin')) {
        this.show('Choose a plan to get started.');
        return;
      }
    }
    sessionStorage.removeItem('pendingSubscribe');
  }

  /**
   * Lazily loads and returns the AuthenticationManager singleton.
   * @private
   * @returns {Promise<Object|null>} The AuthenticationManager instance or null
   */
  async _getAuthManager() {
    try {
      const { AuthenticationManager } = await import('./authenticationController.js');
      return AuthenticationManager.getInstance();
    } catch (error) {
      console.error('Failed to load AuthenticationManager:', error);
      return null;
    }
  }
}

export { SubscriptionDialogController, SUBSCRIPTION_PLANS };
