import {
  SubscriptionDialogController,
  SUBSCRIPTION_PLANS,
} from '../../src/controller/subscriptionDialogController.js';

describe('SubscriptionDialogController', () => {
  let dialogContainer;
  let controller;

  /**
   * Creates the subscription dialog DOM structure matching index.html.
   * Inserted into the document for each test and removed after.
   */
  function createDialogDOM() {
    const html = `
      <dialog id="subscriptionDialog" class="no-padding border surface-container-high small-round">
        <div>
          <header class="fill top-round small-round small-padding right-padding" style="min-block-size: 3.2rem;">
            <nav>
              <h6 class="max">Subscription Required</h6>
              <button class="circle medium transparent" data-ui="#subscriptionDialog">
                <i class="medium bold">close</i>
              </button>
            </nav>
          </header>
          <p id="subscriptionDialogMessage" class="bold center-align small-padding no-margin">
            You've reached the free layout limit.
          </p>
          <div id="subscriptionSignInPrompt" class="padding center-align hidden">
            <i class="extra primary-text">account_circle</i>
            <p class="bold">Sign in to subscribe</p>
            <p>Create a free account or sign in to view subscription plans.</p>
            <button id="subscriptionSignInButton" class="small-round">
              <i>login</i>
              <span>Sign In</span>
            </button>
            <button id="subscriptionSignUpButton" class="small-round">
              <i>person_add</i>
              <span>Create Account</span>
            </button>
          </div>
          <div id="subscriptionVerifyEmailPrompt" class="padding center-align hidden">
            <i class="extra primary-text">mark_email_unread</i>
            <p class="bold extra-text">Verify Your Email</p>
            <p class="extra-text">You must verify your email address before subscribing to a Pro Plan.</p>
            <div class="small-padding">
              <button id="subscriptionVerifyEmailButton" class="responsive primary round extra-text">
                <i>verified</i>
                <span>Verify Email</span>
              </button>
            </div>
          </div>
          <div id="subscriptionPlansSection" class="padding">
            <nav class="center-align no-margin small-padding">
              <div class="border small-round" id="subscriptionIntervalToggle">
                <button class="small-round no-border active" id="subscriptionMonthlyBtn" data-interval="month">
                  <span>Monthly</span>
                </button>
                <button class="small-round no-border" id="subscriptionAnnualBtn" data-interval="year">
                  <span>Annual</span>
                  <span class="badge none small-round" style="position: static; margin-left: 0.25rem;">Save 17%</span>
                </button>
              </div>
            </nav>
            <div class="grid small-padding" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="border small-round padding surface-container" id="subscriptionFreePlan">
                <h6 class="small no-margin">Free</h6>
                <div class="small-padding">
                  <span class="large-text bold">$0</span>
                </div>
                <p class="small-text no-margin" style="min-height: 1.5rem;">Current plan</p>
                <hr class="small-margin">
                <ul class="no-margin no-padding small-text" style="list-style: none;">
                  <li class="small-padding"><i class="small">check</i> Design, save & print 1 layout</li>
                  <li class="small-padding"><i class="small">check</i> Detailed parts list with purchase links</li>
                  <li class="small-padding"><i class="small">check</i> 24/7 access to tutorials & support resources</li>
                </ul>
              </div>
              <div class="border small-round padding primary-container" id="subscriptionProPlan">
                <nav class="no-padding no-margin">
                  <h6 class="small no-margin max">Pro</h6>
                  <span class="badge none primary small-round small-text">Recommended</span>
                </nav>
                <div class="small-padding">
                  <span class="large-text bold" id="subscriptionProPrice">$7</span>
                  <span class="small-text" id="subscriptionProInterval">/month</span>
                </div>
                <p class="small-text no-margin" id="subscriptionProAnnualNote" style="min-height: 1.5rem;"></p>
                <hr class="small-margin">
                <ul class="no-margin no-padding small-text" style="list-style: none;">
                  <li class="small-padding"><i class="small">check</i> Unlimited cloud layouts</li>
                  <li class="small-padding"><i class="small">check</i> Publish to community gallery</li>
                  <li class="small-padding"><i class="small">check</i> Detailed parts list with purchase links</li>
                  <li class="small-padding"><i class="small">check</i> 24/7 access to tutorials & support resources</li>
                </ul>
                <button class="small-round responsive" id="subscriptionProSubscribeBtn">
                  <i>rocket_launch</i>
                  <span>Subscribe</span>
                </button>
              </div>
            </div>
            <nav class="center-align small-padding no-margin">
              <a href="https://www.bricklayouts.com/pricing" target="_blank" rel="noopener" class="link small-text">
                View full plan details & FAQ
                <i class="small">open_in_new</i>
              </a>
            </nav>
          </div>
        </div>
      </dialog>
    `;
    const container = document.createElement('div');
    container.id = 'subscriptionDialogTestContainer';
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  }

  /**
   * Refreshes the singleton's cached DOM references to point at the test DOM.
   * This is necessary because the singleton caches element references in its
   * constructor, which may run before the test DOM is inserted.
   */
  function refreshControllerDOMRefs(ctrl) {
    ctrl.dialogElement = document.getElementById('subscriptionDialog');
    ctrl.messageElement = document.getElementById('subscriptionDialogMessage');
    ctrl.signInPrompt = document.getElementById('subscriptionSignInPrompt');
    ctrl.verifyEmailPrompt = document.getElementById('subscriptionVerifyEmailPrompt');
    ctrl.plansSection = document.getElementById('subscriptionPlansSection');
    ctrl.proPrice = document.getElementById('subscriptionProPrice');
    ctrl.proInterval = document.getElementById('subscriptionProInterval');
    ctrl.proAnnualNote = document.getElementById('subscriptionProAnnualNote');
    ctrl.proSubscribeBtn = document.getElementById('subscriptionProSubscribeBtn');
    ctrl.monthlyBtn = document.getElementById('subscriptionMonthlyBtn');
    ctrl.annualBtn = document.getElementById('subscriptionAnnualBtn');
    ctrl.freePlanCard = document.getElementById('subscriptionFreePlan');
    ctrl._attachCloseHandler();
  }

  beforeEach(() => {
    // Provide a global `ui` function that BeerCSS dialog toggling expects
    if (!window.ui) {
      window.ui = () => {};
    }
    dialogContainer = createDialogDOM();
    controller = SubscriptionDialogController.getInstance();
    refreshControllerDOMRefs(controller);
    // Reset interval to default state
    controller._selectedInterval = 'month';
  });

  afterEach(() => {
    if (dialogContainer && dialogContainer.parentNode) {
      dialogContainer.parentNode.removeChild(dialogContainer);
    }
  });

  describe('singleton pattern', () => {
    it('getInstance returns the same instance on multiple calls', () => {
      const instance1 = SubscriptionDialogController.getInstance();
      const instance2 = SubscriptionDialogController.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('constructor throws when called directly after getInstance', () => {
      // Ensure singleton is initialized
      SubscriptionDialogController.getInstance();

      expect(() => new SubscriptionDialogController())
        .toThrowError('Use SubscriptionDialogController.getInstance() instead of new.');
    });
  });

  describe('plan card rendering', () => {
    it('SUBSCRIPTION_PLANS contains free and pro plans', () => {
      expect(SUBSCRIPTION_PLANS.length).toBe(2);

      const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free');
      expect(freePlan).toBeDefined();
      expect(freePlan.name).toBe('Free');
      expect(freePlan.monthlyPrice).toBe(0);

      const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro');
      expect(proPlan).toBeDefined();
      expect(proPlan.name).toBe('Pro');
      expect(proPlan.monthlyPrice).toBe(7);
      expect(proPlan.annualPrice).toBe(70);
    });

    it('free plan card displays correct features', () => {
      const freePlanCard = document.getElementById('subscriptionFreePlan');
      expect(freePlanCard).not.toBeNull();

      const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free');
      const listItems = freePlanCard.querySelectorAll('li');
      expect(listItems.length).toBe(freePlan.features.length);

      freePlan.features.forEach((feature, index) => {
        expect(listItems[index].textContent).toContain(feature);
      });
    });

    it('pro plan card displays correct features', () => {
      const proPlanCard = document.getElementById('subscriptionProPlan');
      expect(proPlanCard).not.toBeNull();

      const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro');
      const listItems = proPlanCard.querySelectorAll('li');
      expect(listItems.length).toBe(proPlan.features.length);

      proPlan.features.forEach((feature, index) => {
        expect(listItems[index].textContent).toContain(feature);
      });
    });

    it('pro plan card displays monthly price by default', () => {
      const priceEl = document.getElementById('subscriptionProPrice');
      const intervalEl = document.getElementById('subscriptionProInterval');

      expect(priceEl.textContent).toContain('7');
      expect(intervalEl.textContent).toContain('/month');
    });

    it('free plan card displays $0 price', () => {
      const freePlanCard = document.getElementById('subscriptionFreePlan');
      const priceText = freePlanCard.querySelector('.large-text.bold');
      expect(priceText.textContent).toContain('$0');
    });

    it('billing interval toggle switches to annual pricing', () => {
      controller._setInterval('year');

      const priceEl = document.getElementById('subscriptionProPrice');
      const intervalEl = document.getElementById('subscriptionProInterval');
      const annualNote = document.getElementById('subscriptionProAnnualNote');

      expect(priceEl.textContent).toContain('70');
      expect(intervalEl.textContent).toContain('/year');
      expect(annualNote.textContent).toContain((70 / 12).toFixed(2));
    });

    it('billing interval toggle switches back to monthly pricing', () => {
      controller._setInterval('year');
      controller._setInterval('month');

      const priceEl = document.getElementById('subscriptionProPrice');
      const intervalEl = document.getElementById('subscriptionProInterval');
      const annualNote = document.getElementById('subscriptionProAnnualNote');

      expect(priceEl.textContent).toContain('7');
      expect(intervalEl.textContent).toContain('/month');
      expect(annualNote.textContent).toBe('');
    });
  });

  describe('sign-in prompt for unauthenticated users', () => {
    it('shows sign-in prompt and hides plans when user is not authenticated', async () => {
      // Mock _getAuthManager to return unauthenticated state
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({ isAuthenticated: false })
      );

      await controller.show();

      const signInPrompt = document.getElementById('subscriptionSignInPrompt');
      const plansSection = document.getElementById('subscriptionPlansSection');

      expect(signInPrompt.classList.contains('hidden')).toBeFalse();
      expect(plansSection.classList.contains('hidden')).toBeTrue();
    });

    it('shows plans and hides sign-in prompt when user is authenticated', async () => {
      // Mock _getAuthManager to return authenticated state
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(true),
          getUserGroups: () => Promise.resolve([]),
        })
      );

      await controller.show();

      const signInPrompt = document.getElementById('subscriptionSignInPrompt');
      const plansSection = document.getElementById('subscriptionPlansSection');

      expect(signInPrompt.classList.contains('hidden')).toBeTrue();
      expect(plansSection.classList.contains('hidden')).toBeFalse();
    });

    it('shows sign-in prompt when authManager is null', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(Promise.resolve(null));

      await controller.show();

      const signInPrompt = document.getElementById('subscriptionSignInPrompt');
      const plansSection = document.getElementById('subscriptionPlansSection');

      expect(signInPrompt.classList.contains('hidden')).toBeFalse();
      expect(plansSection.classList.contains('hidden')).toBeTrue();
    });
  });

  describe('email verification prompt', () => {
    it('shows verify email prompt when authenticated but email not verified', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(false),
        })
      );

      await controller.show();

      const signInPrompt = document.getElementById('subscriptionSignInPrompt');
      const verifyEmailPrompt = document.getElementById('subscriptionVerifyEmailPrompt');
      const plansSection = document.getElementById('subscriptionPlansSection');

      expect(verifyEmailPrompt.classList.contains('hidden')).toBeFalse();
      expect(signInPrompt.classList.contains('hidden')).toBeTrue();
      expect(plansSection.classList.contains('hidden')).toBeTrue();
      expect(controller.dialogElement.getAttribute('data-view')).toBe('verify');
    });

    it('hides verify email prompt when user is not authenticated', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({ isAuthenticated: false })
      );

      await controller.show();

      const verifyEmailPrompt = document.getElementById('subscriptionVerifyEmailPrompt');
      expect(verifyEmailPrompt.classList.contains('hidden')).toBeTrue();
    });

    it('hides verify email prompt when user is authenticated and verified', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(true),
          getUserGroups: () => Promise.resolve([]),
        })
      );

      await controller.show();

      const verifyEmailPrompt = document.getElementById('subscriptionVerifyEmailPrompt');
      expect(verifyEmailPrompt.classList.contains('hidden')).toBeTrue();
    });
  });

  describe('recommended plan highlighting', () => {
    it('pro plan is marked as recommended in SUBSCRIPTION_PLANS', () => {
      const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro');
      expect(proPlan.recommended).toBeTrue();
    });

    it('free plan is not marked as recommended', () => {
      const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free');
      expect(freePlan.recommended).toBeFalse();
    });

    it('pro plan card uses primary-container class for visual highlighting', () => {
      const proPlanCard = document.getElementById('subscriptionProPlan');
      expect(proPlanCard.classList.contains('primary-container')).toBeTrue();
    });

    it('free plan card uses surface-container class (not highlighted)', () => {
      const freePlanCard = document.getElementById('subscriptionFreePlan');
      expect(freePlanCard.classList.contains('surface-container')).toBeTrue();
      expect(freePlanCard.classList.contains('primary-container')).toBeFalse();
    });

    it('pro plan card displays "Recommended" badge', () => {
      const proPlanCard = document.getElementById('subscriptionProPlan');
      const badge = proPlanCard.querySelector('.badge');
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Recommended');
    });

    it('free plan card does not display a "Recommended" badge', () => {
      const freePlanCard = document.getElementById('subscriptionFreePlan');
      const badge = freePlanCard.querySelector('.badge');
      expect(badge).toBeNull();
    });
  });

  describe('current plan indicator', () => {
    it('shows "Current plan" on free plan for non-subscribers', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(true),
          getUserGroups: () => Promise.resolve([]),
        })
      );

      await controller.show();

      const freePlanCard = document.getElementById('subscriptionFreePlan');
      const statusText = freePlanCard.querySelector('p.small-text');
      expect(statusText.textContent).toContain('Current plan');
    });

    it('shows "Current plan" on pro button for subscribers', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(true),
          getUserGroups: () => Promise.resolve(['subscription']),
        })
      );

      await controller.show();

      const proBtn = document.getElementById('subscriptionProSubscribeBtn');
      expect(proBtn.textContent).toContain('Current plan');
      expect(proBtn.disabled).toBeTrue();
    });

    it('shows subscribe button for non-subscribers on pro plan', async () => {
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getEmailVerified: () => Promise.resolve(true),
          getUserGroups: () => Promise.resolve([]),
        })
      );

      await controller.show();

      const proBtn = document.getElementById('subscriptionProSubscribeBtn');
      expect(proBtn.textContent).toContain('Upgrade');
      expect(proBtn.disabled).toBeFalse();
    });
  });

  describe('pending subscribe flow', () => {
    afterEach(() => {
      sessionStorage.removeItem('pendingSubscribe');
    });

    it('_checkPendingSubscribe re-shows dialog when authenticated', async () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getUserGroups: () => Promise.resolve([]),
        })
      );
      spyOn(controller, 'show');

      await controller._checkPendingSubscribe();

      expect(sessionStorage.getItem('pendingSubscribe')).toBe('true');
      expect(controller.show).toHaveBeenCalled();
    });

    it('_checkPendingSubscribe does not show dialog for existing subscribers', async () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getUserGroups: () => Promise.resolve(['subscription']),
        })
      );
      spyOn(controller, 'show');

      await controller._checkPendingSubscribe();

      expect(sessionStorage.getItem('pendingSubscribe')).toBeNull();
      expect(controller.show).not.toHaveBeenCalled();
    });

    it('_checkPendingSubscribe clears intent when not authenticated', async () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({ isAuthenticated: false })
      );

      await controller._checkPendingSubscribe();

      expect(sessionStorage.getItem('pendingSubscribe')).toBeNull();
    });

    it('_checkPendingSubscribe clears intent when authManager is null', async () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve(null)
      );

      await controller._checkPendingSubscribe();

      expect(sessionStorage.getItem('pendingSubscribe')).toBeNull();
    });

    it('_onPlanSelect clears pendingSubscribe before checkout', async () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      spyOn(controller, '_getAuthManager').and.returnValue(
        Promise.resolve({
          isAuthenticated: true,
          getUserGroups: () => Promise.resolve([]),
        })
      );

      // The dynamic import will fail in test, which is fine —
      // we just need to verify sessionStorage was cleared before that point
      await controller._onPlanSelect('pro', 'month').catch(() => {});

      expect(sessionStorage.getItem('pendingSubscribe')).toBeNull();
    });

    it('dialog close event clears pendingSubscribe when not transitioning', () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      controller._transitioning = false;

      controller.dialogElement.dispatchEvent(new Event('close'));

      expect(sessionStorage.getItem('pendingSubscribe')).toBeNull();
    });

    it('dialog close event preserves pendingSubscribe when transitioning', () => {
      sessionStorage.setItem('pendingSubscribe', 'true');
      controller._transitioning = true;

      controller.dialogElement.dispatchEvent(new Event('close'));

      expect(sessionStorage.getItem('pendingSubscribe')).toBe('true');
      expect(controller._transitioning).toBeFalse();
    });
  });
});
