/**
 * AuthenticationModal - Modal interface for login and signup forms
 * This module is PUBLIC and accessible to all users for authentication.
 * It must be accessible to show login/signup forms to unauthenticated users.
 * Uses singleton pattern - only one instance exists in the DOM.
 * Follows AirBNB JavaScript style guide.
 */


/**
 * Validation patterns
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Singleton instance
 */
let instance = null;

/**
 * Function to call when the modal closes.
 * @callback successCallback
 */

/**
 * AuthenticationModal class for handling login and signup flows
 * Uses singleton pattern - call AuthenticationModal.getInstance() to get the instance
 */
class AuthenticationModal {
  /**
   * Gets the singleton instance of AuthenticationModal
   * @param {Object} authManager - The AuthenticationManager instance
   * @returns {AuthenticationModal} The singleton instance
   */
  static getInstance(authManager) {
    if (!instance) {
      instance = new AuthenticationModal(authManager);
    } else if (authManager) {
      instance.authManager = authManager;
    }
    return instance;
  }

  /**
   * Creates a new AuthenticationModal instance (private - use getInstance)
   * @param {Object} authManager - The AuthenticationManager instance
   */
  constructor(authManager) {
    if (instance !== null) {
      throw new Error('AuthenticationModal is a singleton. Use getInstance() instead.');
    }
    this.authManager = authManager;
    this.dialogElement = null;
    this.currentMode = 'login';
    this.isLoading = false;
    /** @type {successCallback} */
    this.onSuccess = null;
    this.forgotPasswordEmail = null;
  }

  /**
   * Creates the dialog HTML structure if it doesn't exist
   * @private
   */
  _createDialogElement() {
    if (this.dialogElement) {
      return;
    }

    this.dialogElement = document.createElement('dialog');
    this.dialogElement.id = 'authenticationModal';
    this.dialogElement.className = 'no-padding border large-width surface-container-high small-round';
    this.dialogElement.innerHTML = this._getDialogShellHTML();
    document.body.appendChild(this.dialogElement);
    this.dialogElement.addEventListener('close', () => {
        if (typeof this.onSuccess === 'function') {
          this.onSuccess();
        }
        this.isLoading = false;
    });

    this._attachLoginFormListeners();
    this._attachSignupFormListeners();
    this._attachForgotPasswordFormListeners();
    this._attachResetPasswordFormListeners();
  }

  /**
   * Returns the base HTML shell for the dialog with both forms
   * @private
   * @returns {string} HTML string
   */
  _getDialogShellHTML() {
    return `
      <div>
        <header class="fill top-round small-round small-padding right-padding" style="min-block-size: 3.2rem;">
          <nav>
            <h6 class="max authModal-title authModal-login-title">Sign In</h6>
            <h6 class="max authModal-title authModal-signup-title">Create Account</h6>
            <h6 class="max authModal-title authModal-success-title">Welcome!</h6>
            <h6 class="max authModal-title authModal-confirm-title">Please Verify Email</h6>
            <h6 class="max authModal-title authModal-forgotpw-title">Reset Password</h6>
            <h6 class="max authModal-title authModal-resetpw-title">Reset Password</h6>
            <button class="circle medium transparent" id="authModalClose" data-ui="#authenticationModal">
              <i class="medium bold">close</i>
            </button>
          </nav>
        </header>
        <div id="authModalContent" class="small-padding horizontal-padding">
          <div class="authModal-view authModal-login-view">
            ${this._getLoginFormHTML()}
          </div>
          <div class="authModal-view authModal-presignup-view">
            ${this._getPreSignupFormHTML()}
          </div>
          <div class="authModal-view authModal-signup-view">
            ${this._getSignupFormHTML()}
          </div>
          <div class="authModal-view authModal-success-view">
            <!-- Success content inserted dynamically -->
          </div>
          <div class="authModal-view authModal-confirm-view">
            <!-- Confirm content inserted dynamically -->
          </div>
          <div class="authModal-view authModal-forgotpw-view">
            ${this._getForgotPasswordFormHTML()}
          </div>
          <div class="authModal-view authModal-resetpw-view">
            ${this._getResetPasswordFormHTML()}
          </div>
        </div>
        <div id="authModalMessage" class="small-padding large-text horizontal-padding hidden">
          <!-- Success/error messages -->
        </div>
      </div>
    `;
  }

  /**
   * Returns the HTML for the login form
   * @private
   * @returns {string} HTML string
   */
  _getLoginFormHTML() {
    return `
      <div class="extra-text">
        <div class="field label border small-margin">
          <input type="email" id="loginEmail" class="extra-text" autocomplete="email" autofocus required>
          <label>Email</label>
          <output class="invalid">placeholder</output>
        </div>
        <div class="field label border small-margin suffix">
          <input type="password" id="loginPassword" class="extra-text" autocomplete="current-password" required>
          <label>Password</label>
          <output class="invalid">placeholder</output>
          <i class="front extra">visibility</i>
        </div>
      </div>
      <div class="right-align small-margin extra-text horizontal-margin">
        <a href="#" id="switchToForgotPassword" class="link">Forgot password?</a>
      </div>
      <div class="small-padding">
        <button id="loginSubmitBtn" class="responsive extra-text primary round" style="display: inline-flex">
          <i>login</i>
          <span>Sign In</span>
        </button>
      </div>
      <div class="center-align">
        <span class="extra-text secondary-text">or</span>
      </div>
      <div class="small-padding">
        <button id="googleLoginBtn" class="responsive border extra-text primary-border round">
          <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
      <hr style="background-color: var(--outline)">
      <div class="center-align small-padding extra-text">
        <span class="secondary-text">Don't have an account?</span>
        <a href="#" id="switchToSignup" class="link">Sign up</a>
      </div>
    `;
  }

  _getPreSignupFormHTML() {
    return `
      <h2>Welcome to BrickLayouts</h2>
      <div class="small-padding">
        <button id="googlePreSignupBtn" class="responsive border extra-text primary-border">
          <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Sign up with Google</span>
        </button>
      </div>
      <div class="center-align">
        <span class="extra-text secondary-text">or</span>
      </div>
      <div class="extra-text">
        <div class="field label border small-margin">
          <input type="email" id="presignupEmail" autocomplete="email" required>
          <label>Email</label>
        </div>
      </div>
      <div class="small-padding">
        <button id="presignupSubmitBtn" class="responsive extra-text primary" style="display:inline-flex">
          <i>person_add</i>
          <span>Sign up with email</span>
        </button>
      </div>      
      <hr style="background-color: var(--outline)">
      <div class="center-align small-padding extra-text">
        <span class="secondary-text">Already have an account?</span>
        <a href="#" id="preswitchToLogin" class="link">Sign in</a>
      </div>
    `;
  }

  /**
   * Returns the HTML for the signup form
   * @private
   * @returns {string} HTML string
   */
  _getSignupFormHTML() {
    return `
      <h2 class="center-align">Welcome to BrickLayouts</h2>
      <div class="extra-text">
        <div class="field label border small-margin">
          <input type="email" class="extra-text" id="signupEmail" autocomplete="email" required>
          <label>Email</label>
          <output class="invalid">placeholder</output>
        </div>
        <div class="field label border small-margin">
          <input type="text" class="extra-text" id="signupName" autocomplete="name" title="What should we call you?" required>
          <label>Name</label>
          <output>What should we call you?</output>
          <output class="invalid">placeholder</output>
        </div>
        <div class="field label border small-margin suffix">
          <input type="password" class="extra-text" id="signupPassword" autocomplete="new-password" required>
          <label>Password</label>
          <output class="invalid">placeholder</output>
          <i class="front extra">visibility</i>
        </div>
        <div class="field label border small-margin suffix">
          <input type="password" class="extra-text" id="signupConfirmPassword" autocomplete="new-password" required>
          <label>Confirm Password</label>
          <output class="invalid">placeholder</output>
          <i class="front extra">visibility</i>
        </div>
        <div class="field small-margin">
          <label class="checkbox large">
            <input id="signupNewsletter" type="checkbox">
            <span class="extra-text">Sign up for our awesome newsletter</span>
          </label>
        </div>
      </div>
      <div class="small-padding">
        <button id="signupSubmitBtn" class="responsive extra-text primary round" style="display:inline-flex">
          <i>person_add</i>
          <span>Create Account</span>
        </button>
      </div>
      <div class="center-align">
        <span class="extra-text secondary-text">or</span>
      </div>
      <div class="small-padding">
        <button id="googleSignupBtn" class="responsive border extra-text primary-border round">
          <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Sign up with Google</span>
        </button>
      </div>
      <div class="center-align">
        By continuing you are agreeing to our <a href="https://www.bricklayouts.com/terms" class="underline" target="_blank">Terms of Use</a> and <a href="https://www.bricklayouts.com/privacy" class="underline" target="_blank">Privacy Policy</a>
      </div>
      <hr style="background-color: var(--outline)">
      <div class="center-align small-padding extra-text">
        <span class="secondary-text">Already have an account?</span>
        <a href="#" id="switchToLogin" class="link">Sign in</a>
      </div>
    `;
  }

  /**
   * Returns the HTML for the success message after signup
   * @private
   * @param {string} message - Success message to display
   * @returns {string} HTML string
   */
  _getSuccessViewHTML(message) {
    return `
      <div class="center-align padding">
        <i class="extra primary-text">check_circle</i>
        <p class="bold extra-text">${this._escapeHtml(message)}</p>
        <p class="extra-text">
          A verification code has been sent to your email.<div class="small-space"></div>
          You have 24 hours of full access while we wait for verification.
        </p>
        <div class="field label border small-margin">
          <input type="text" class="extra-text" id="verificationCode" maxlength="6" pattern="[0-9]{6}" 
            autocomplete="one-time-code" required>
          <label>Verification Code</label>
          <output>Enter the 6-digit code we emailed you</output>
          <output class="invalid">placeholder</output>
        </div>
        <div class="small-padding">
          <button id="verifyCodeBtn" class="responsive extra-text primary round" style="display:inline-flex">
            <i>verified</i>
            <span>Verify Email</span>
          </button>
        </div>
        <div class="small-padding">
          <button id="resendCodeBtn" class="responsive border extra-text round" style="display:inline-flex">
            <span>Resend Code</span>
          </button>
        </div>
        <hr class="small-margin bottom-margin secondary" style="background-color: var(--outline)">
        <button id="successCloseBtn" class="responsive border extra-text round" style="display:inline-flex">
          <span>Continue Without Verifying</span>
        </button>
      </div>
    `;
  }

  /**
   * Returns the HTML for the confirmation code screen after login
   * @private
   * @param {string} message - Message to display
   * @returns {string} HTML string
   */
  _getConfirmViewHTML(message) {
    return `
      <div class="center-align padding">
        <i class="extra primary-text">lock</i>
        <p class="bold extra-text">${this._escapeHtml(message)}</p>
        <p class="extra-text">
          You're email address has not been verified. You must verify your email address to continue to use BrickLayouts.
        </p>
        <div class="field label border small-margin">
          <input type="text" class="extra-text" id="verificationCodeLogin" maxlength="6" pattern="[0-9]{6}"
            autocomplete="one-time-code" required>
          <label>Verification Code</label>
          <output>Enter the 6-digit code we emailed you</output>
          <output class="invalid">placeholder</output>
        </div>
        <div class="small-padding">
          <button id="verifyCodeLoginBtn" class="responsive extra-text primary round" style="display:inline-flex">
            <i>verified</i>
            <span>Verify Email</span>
          </button>
        </div>
        <div class="small-padding">
          <button id="resendCodeLoginBtn" class="responsive border extra-text round" style="display:inline-flex">
            <span>Resend Code</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Returns the HTML for the forgot password form
   * @private
   * @returns {string} HTML string
   */
  _getForgotPasswordFormHTML() {
    return `
      <div class="center-align padding">
        <i class="extra primary-text">lock_reset</i>
        <p class="extra-text">
          Enter your email address and we'll send you a verification code to reset your password.
        </p>
      </div>
      <div class="extra-text">
        <div class="field label border small-margin">
          <input type="email" id="forgotpwEmail" class="extra-text" autocomplete="email" required>
          <label>Email</label>
          <output class="invalid">placeholder</output>
        </div>
      </div>
      <div class="small-padding">
        <button id="forgotpwSubmitBtn" class="responsive extra-text primary round" style="display: inline-flex">
          <i>send</i>
          <span>Send Reset Code</span>
        </button>
      </div>
      <hr style="background-color: var(--outline)">
      <div class="center-align small-padding extra-text">
        <a href="#" id="forgotpwBackToLogin" class="link">Back to Sign In</a>
      </div>
    `;
  }

  /**
   * Returns the HTML for the reset password form
   * @private
   * @returns {string} HTML string
   */
  _getResetPasswordFormHTML() {
    return `
      <div class="center-align padding">
        <i class="extra primary-text">lock_reset</i>
        <p class="extra-text">
          If you have an account with us, a verification code has been sent to your email.
        </p>
      </div>
      <div class="extra-text">
        <div class="field label border small-margin">
          <input type="text" class="extra-text" id="resetpwCode" maxlength="6" pattern="[0-9]{6}"
            autocomplete="one-time-code" required>
          <label>Verification Code</label>
          <output>Enter the 6-digit code we emailed you</output>
          <output class="invalid">placeholder</output>
        </div>
        <div class="field label border small-margin suffix">
          <input type="password" class="extra-text" id="resetpwNewPassword" autocomplete="new-password" required>
          <label>New Password</label>
          <output class="invalid">placeholder</output>
          <i class="front extra">visibility</i>
        </div>
        <div class="field label border small-margin suffix">
          <input type="password" class="extra-text" id="resetpwConfirmPassword" autocomplete="new-password" required>
          <label>Confirm New Password</label>
          <output class="invalid">placeholder</output>
          <i class="front extra">visibility</i>
        </div>
      </div>
      <div class="small-padding">
        <button id="resetpwSubmitBtn" class="responsive extra-text primary round" style="display: inline-flex">
          <i>lock_reset</i>
          <span>Reset Password</span>
        </button>
      </div>
      <hr style="background-color: var(--outline)">
      <div class="center-align small-padding">
        <a href="#" id="resetpwBackToLogin" class="link">Back to Sign In</a>
      </div>
    `;
  }

  /**
   * Attaches event listeners for the login form
   * @private
   */
  _attachLoginFormListeners() {
    const submitBtn = this.dialogElement.querySelector('#loginSubmitBtn');
    const googleBtn = this.dialogElement.querySelector('#googleLoginBtn');
    const switchLink = this.dialogElement.querySelector('#switchToSignup');
    const emailInput = this.dialogElement.querySelector("#loginEmail");
    const passwordInput = this.dialogElement.querySelector('#loginPassword');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._handleLogin());
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', () => this._handleGoogleAuth());
    }

    if (switchLink) {
      switchLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.setMode('signup');
      });
    }

    const forgotLink = this.dialogElement.querySelector('#switchToForgotPassword');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const loginEmailValue = emailInput?.value?.trim() || '';
        this.setMode('forgotpw');
        const forgotpwEmailInput = this.dialogElement.querySelector('#forgotpwEmail');
        if (forgotpwEmailInput && loginEmailValue) {
          forgotpwEmailInput.value = loginEmailValue;
        }
      });
    }

    emailInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    emailInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    passwordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._handleLogin();
      }
      e.stopPropagation();
    });

    passwordInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
  }

  /**
   * Attaches event listeners for the signup form
   * @private
   */
  _attachSignupFormListeners() {
    const submitBtn = this.dialogElement.querySelector('#signupSubmitBtn');
    const googleBtn = this.dialogElement.querySelector('#googleSignupBtn');
    const switchLink = this.dialogElement.querySelector('#switchToLogin');
    const emailInput = this.dialogElement.querySelector("#signupEmail");
    const nameInput = this.dialogElement.querySelector("#signupName");
    const passwordInput = this.dialogElement.querySelector("#signupPassword");
    const confirmPasswordInput = this.dialogElement.querySelector('#signupConfirmPassword');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._handleSignup());
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', () => this._handleGoogleAuth());
    }

    if (switchLink) {
      switchLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.setMode('login');
      });
    }

    emailInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    emailInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    nameInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    nameInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    passwordInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    passwordInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    // Submit on Enter key
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._handleSignup();
        }
        e.stopPropagation();
      });
    }

    confirmPasswordInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
  }

  /**
   * Attaches event listeners for the success view
   * @private
   */
  _attachSuccessViewListeners() {
    const closeBtn = this.dialogElement.querySelector('#successCloseBtn');
    const verifyBtn = this.dialogElement.querySelector('#verifyCodeBtn');
    const resendBtn = this.dialogElement.querySelector('#resendCodeBtn');
    const codeInput = this.dialogElement.querySelector('#verificationCode');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        ui("#authenticationModal");
      });
    }

    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this._handleVerifyCode());
    }

    if (resendBtn) {
      resendBtn.addEventListener('click', () => this._handleResendCode());
    }

    if (codeInput) {
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._handleVerifyCode();
        }
        e.stopPropagation();
      });

      codeInput.addEventListener('input', (event) => {
        if (event.target.value.length > 0) {
          event.target.parentElement.classList.remove('invalid');
        }
      });
    }
  }

  /**
   * Attaches event listeners for the confirm view
   * @private
   */
  _attachConfirmViewListeners() {
    const verifyBtn = this.dialogElement.querySelector('#verifyCodeLoginBtn');
    const resendBtn = this.dialogElement.querySelector('#resendCodeLoginBtn');
    const codeInput = this.dialogElement.querySelector('#verificationCodeLogin');

    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this._handleVerifyCode());
    }

    if (resendBtn) {
      resendBtn.addEventListener('click', () => this._handleResendCode());
    }

    if (codeInput) {
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._handleVerifyCode();
        }
        e.stopPropagation();
      });

      codeInput.addEventListener('input', (event) => {
        if (event.target.value.length > 0) {
          event.target.parentElement.classList.remove('invalid');
        }
      });
    }
  }

  /**
   * Attaches event listeners for the forgot password form
   * @private
   */
  _attachForgotPasswordFormListeners() {
    const submitBtn = this.dialogElement.querySelector('#forgotpwSubmitBtn');
    const backLink = this.dialogElement.querySelector('#forgotpwBackToLogin');
    const emailInput = this.dialogElement.querySelector('#forgotpwEmail');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._handleForgotPassword());
    }

    if (backLink) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.forgotPasswordEmail = null;
        this.setMode('login');
      });
    }

    emailInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._handleForgotPassword();
      }
      e.stopPropagation();
    });

    emailInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
  }

  /**
   * Attaches event listeners for the reset password form
   * @private
   */
  _attachResetPasswordFormListeners() {
    const submitBtn = this.dialogElement.querySelector('#resetpwSubmitBtn');
    const backLink = this.dialogElement.querySelector('#resetpwBackToLogin');
    const codeInput = this.dialogElement.querySelector('#resetpwCode');
    const newPasswordInput = this.dialogElement.querySelector('#resetpwNewPassword');
    const confirmPasswordInput = this.dialogElement.querySelector('#resetpwConfirmPassword');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._handleResetPassword());
    }

    if (backLink) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.forgotPasswordEmail = null;
        this.setMode('login');
      });
    }

    codeInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    
    codeInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    newPasswordInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    newPasswordInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });

    confirmPasswordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._handleResetPassword();
      }
      e.stopPropagation();
    });

    confirmPasswordInput?.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
  }

  /**
   * Handles forgot password form submission
   * @private
   */
  async _handleForgotPassword() {
    if (this.isLoading) {
      return;
    }

    const emailInput = this.dialogElement.querySelector('#forgotpwEmail');
    const submitBtn = this.dialogElement.querySelector('#forgotpwSubmitBtn');
    const email = emailInput.value.trim().toLowerCase();

    if (!this._isValidEmail(email)) {
      emailInput.parentElement.querySelector('output.invalid').textContent = 'Please enter a valid email address.';
      emailInput.parentElement.classList.add('invalid');
      emailInput.focus();
      return;
    }

    this.isLoading = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<progress class="circle small"></progress><span>Sending...</span>';
    submitBtn.disabled = true;

    try {
      await this.authManager.forgotPassword(email);
    } catch (error) {
      // Log for debugging but do NOT show error to user
      console.warn('Forgot password request:', error.message);
    }

    // ALWAYS store email and transition to resetpw, regardless of success/failure.
    // This prevents user enumeration.
    this.forgotPasswordEmail = email;
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    this.isLoading = false;
    this.setMode('resetpw');
  }

  /**
   * Handles reset password form submission
   * @private
   */
  async _handleResetPassword() {
    if (this.isLoading) {
      return;
    }

    const codeInput = this.dialogElement.querySelector('#resetpwCode');
    const newPasswordInput = this.dialogElement.querySelector('#resetpwNewPassword');
    const confirmPasswordInput = this.dialogElement.querySelector('#resetpwConfirmPassword');
    const submitBtn = this.dialogElement.querySelector('#resetpwSubmitBtn');

    const code = codeInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!code || code.length !== 6) {
      codeInput.parentElement.querySelector('output.invalid').textContent = 'Please enter the 6-digit verification code.';
      codeInput.parentElement.classList.add('invalid');
      codeInput.focus();
      return;
    }

    if (!this._isValidPassword(newPassword)) {
      newPasswordInput.parentElement.querySelector('output.invalid').innerHTML =
        'Password must be at least 8 characters.<br/>Must contain uppercase, lowercase, number, and symbol.';
      newPasswordInput.parentElement.classList.add('invalid');
      newPasswordInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      confirmPasswordInput.parentElement.querySelector('output.invalid').textContent =
        'Passwords do not match.';
      confirmPasswordInput.parentElement.classList.add('invalid');
      confirmPasswordInput.focus();
      return;
    }

    this.isLoading = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<progress class="circle small"></progress><span>Resetting...</span>';
    submitBtn.disabled = true;

    try {
      await this.authManager.confirmForgotPassword(
        this.forgotPasswordEmail, code, newPassword
      );
      this.forgotPasswordEmail = null;
      this._showMessage('Password reset successfully! Please sign in.', 'success');
      setTimeout(() => {
        this.setMode('login');
      }, 2000);
    } catch (error) {
      console.error('Password reset failed:', error);
      this._showMessage(
        error.message || 'Password reset failed. Please try again.',
        'error'
      );
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handles verification code submission
   * @private
   */
  async _handleVerifyCode() {
    if (this.isLoading) {
      return;
    }

    const which = this.currentMode === 'success' ? "" : "Login";
    const codeInput = this.dialogElement.querySelector(`#verificationCode${which}`);
    const verifyBtn = this.dialogElement.querySelector(`#verifyCode${which}Btn`);
    const code = codeInput.value.trim();

    if (!code || code.length !== 6) {
      codeInput.parentElement.classList.add('invalid');
      codeInput.parentElement.querySelector('output.invalid').textContent = 'Please enter the 6-digit verification code.';
      codeInput.focus();
      return;
    }

    this.isLoading = true;
    const originalText = verifyBtn.innerHTML;
    verifyBtn.innerHTML = '<progress class="circle small"></progress><span>Verifying...</span>';
    verifyBtn.disabled = true;

    try {
      await this.authManager.confirmSignUp(code);

      // Refresh the session so tokens reflect email_verified = true.
      // The next sign-in (or this refresh) will trigger the PreAuth Lambda
      // which adds the user to cloud-users and clears the grace period.
      if (this.authManager.isAuthenticated) {
        try {
          await this.authManager.refreshSession();
        } catch (refreshErr) {
          console.warn('Session refresh after verification failed:', refreshErr);
          // Not critical — the user is verified, they'll get updated tokens
          // on next sign-in.
        }
      }

      this._showMessage('Email verified successfully!', 'success');

      setTimeout(() => {
        ui("#authenticationModal");
      }, 1500);
    } catch (error) {
      console.error('Verification failed:', error);
      this._showMessage(error.message || 'Verification failed. Please try again.', 'error');
      verifyBtn.innerHTML = originalText;
      verifyBtn.disabled = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handles resend verification code
   * @private
   */
  async _handleResendCode() {
    if (this.isLoading) {
      return;
    }

    const which = this.currentMode === 'success' ? "" : "Login";
    const resendBtn = this.dialogElement.querySelector(`#resendCode${which}Btn`);

    this.isLoading = true;
    const originalText = resendBtn.innerHTML;
    resendBtn.innerHTML = '<progress class="circle small"></progress>';
    resendBtn.disabled = true;

    try {
      await this.authManager.resendVerificationCode();
      this._showMessage('Verification code sent! Check your email.', 'success');
    } catch (error) {
      console.error('Resend failed:', error);
      this._showMessage(error.message || 'Failed to resend code. Please try again.', 'error');
    } finally {
      resendBtn.innerHTML = originalText;
      resendBtn.disabled = false;
      this.isLoading = false;
    }
  }

  /**
   * Sets the current mode and updates visibility
   * @param {string} mode - 'login', 'signup', 'presignup', 'success', 'confirm', 'forgotpw', or 'resetpw'
   */
  setMode(mode) {
    this.currentMode = mode;
    this._clearMessage();
    this._resetForms();

    if (this.dialogElement) {
      this.dialogElement.classList.remove(
        'mode-login', 'mode-signup', 'mode-presignup',
        'mode-success', 'mode-confirm',
        'mode-forgotpw', 'mode-resetpw'
      );
      this.dialogElement.classList.add(`mode-${mode}`);

      // Focus appropriate input
      if (mode === 'login') {
        const emailInput = this.dialogElement.querySelector('#loginEmail');
        if (emailInput) {
          setTimeout(() => emailInput.focus(), 100);
        }
      } else if (mode === 'signup') {
        const emailInput = this.dialogElement.querySelector('#signupEmail');
        if (emailInput) {
          setTimeout(() => emailInput.focus(), 100);
        }
      } else if (mode === 'success') {
        const codeInput = this.dialogElement.querySelector('#verificationCode');
        if (codeInput) {
          setTimeout(() => codeInput.focus(), 100);
        }
      } else if (mode === 'confirm') {
        const codeInput = this.dialogElement.querySelector('#verificationCodeLogin');
        if (codeInput) {
          setTimeout(() => codeInput.focus(), 100);
        }
      } else if (mode === 'forgotpw') {
        const emailInput = this.dialogElement.querySelector('#forgotpwEmail');
        if (emailInput && !emailInput.value) {
          setTimeout(() => emailInput.focus(), 100);
        }
      } else if (mode === 'resetpw') {
        const codeInput = this.dialogElement.querySelector('#resetpwCode');
        if (codeInput) {
          setTimeout(() => codeInput.focus(), 100);
        }
      }
    }
  }

  /**
   * Resets form inputs and button states
   * @private
   */
  _resetForms() {
    if (!this.dialogElement) {
      return;
    }

    // Reset login form
    const loginEmail = this.dialogElement.querySelector('#loginEmail');
    const loginPassword = this.dialogElement.querySelector('#loginPassword');
    const loginBtn = this.dialogElement.querySelector('#loginSubmitBtn');
    const googleLoginBtn = this.dialogElement.querySelector('#googleLoginBtn');

    if (loginEmail) {
      loginEmail.value = '';
      loginEmail.parentElement.classList.remove('invalid');
    }
    if (loginPassword) {
      loginPassword.value = '';
      loginPassword.parentElement.classList.remove('invalid');
    }
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i>login</i><span>Sign In</span>';
    }
    if (googleLoginBtn) {
      googleLoginBtn.disabled = false;
    }

    // Reset signup form
    const signupEmail = this.dialogElement.querySelector('#signupEmail');
    const signupName = this.dialogElement.querySelector('#signupName');
    const signupPassword = this.dialogElement.querySelector('#signupPassword');
    const signupConfirm = this.dialogElement.querySelector('#signupConfirmPassword');
    const signupNewsletter = this.dialogElement.querySelector('#signupNewsletter');
    const signupBtn = this.dialogElement.querySelector('#signupSubmitBtn');
    const googleSignupBtn = this.dialogElement.querySelector('#googleSignupBtn');

    if (signupEmail) {
      signupEmail.value = '';
      signupEmail.parentElement.classList.remove('invalid');
    }
    if (signupName) {
      signupName.value = '';
      signupName.parentElement.classList.remove('invalid');
    }
    if (signupPassword) {
      signupPassword.value = '';
      signupPassword.parentElement.classList.remove('invalid');
    }
    if (signupConfirm) {
      signupConfirm.value = '';
      signupConfirm.parentElement.classList.remove('invalid');
    }
    if (signupNewsletter) signupNewsletter.checked = false;
    if (signupBtn) {
      signupBtn.disabled = false;
      signupBtn.innerHTML = '<i>person_add</i><span>Create Account</span>';
    }
    if (googleSignupBtn) {
      googleSignupBtn.disabled = false;
    }

    // Reset forgot password form
    const forgotpwEmail = this.dialogElement.querySelector('#forgotpwEmail');
    const forgotpwBtn = this.dialogElement.querySelector('#forgotpwSubmitBtn');

    if (forgotpwEmail) {
      forgotpwEmail.value = '';
      forgotpwEmail.parentElement.classList.remove('invalid');
    }
    if (forgotpwBtn) {
      forgotpwBtn.disabled = false;
      forgotpwBtn.innerHTML = '<i>send</i><span>Send Reset Code</span>';
    }

    // Reset password reset form
    const resetpwCode = this.dialogElement.querySelector('#resetpwCode');
    const resetpwNewPassword = this.dialogElement.querySelector('#resetpwNewPassword');
    const resetpwConfirmPassword = this.dialogElement.querySelector('#resetpwConfirmPassword');
    const resetpwBtn = this.dialogElement.querySelector('#resetpwSubmitBtn');

    if (resetpwCode) {
      resetpwCode.value = '';
      resetpwCode.parentElement.classList.remove('invalid');
    }
    if (resetpwNewPassword) {
      resetpwNewPassword.value = '';
      resetpwNewPassword.parentElement.classList.remove('invalid');
    }
    if (resetpwConfirmPassword) {
      resetpwConfirmPassword.value = '';
      resetpwConfirmPassword.parentElement.classList.remove('invalid');
    }
    if (resetpwBtn) {
      resetpwBtn.disabled = false;
      resetpwBtn.innerHTML = '<i>lock_reset</i><span>Reset Password</span>';
    }
  }

  /**
   * Shows the modal dialog
   * @param {string} mode - Optional mode to show: 'login' or 'signup'
   * @param {successCallback} [onSuccess] - Function to call when the modal closes successfully
   */
  show(mode, onSuccess) {
    this._createDialogElement();
    this.setMode(mode || this.currentMode || 'login');
    this.onSuccess = onSuccess;
    ui("#authenticationModal");
  }

  /**
   * Shows the success view after signup
   * @private
   * @param {string} message - Success message to display
   */
  _showSuccessView(message) {
    const successView = this.dialogElement.querySelector('.authModal-success-view');
    if (successView) {
      successView.innerHTML = this._getSuccessViewHTML(message);
      this._attachSuccessViewListeners();
    }
    this.setMode('success');
  }

    /**
   * Shows the confirmation code screen after login
   * @private
   * @param {string} message - Message to display
   */
  _showConfirmView(message) {
    const successView = this.dialogElement.querySelector('.authModal-confirm-view');
    if (successView) {
      successView.innerHTML = this._getConfirmViewHTML(message);
      this._attachConfirmViewListeners();
    }
    this.setMode('confirm');
  }

  /**
   * Validates email format
   * @private
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  _isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return EMAIL_PATTERN.test(email.trim());
  }

  /**
   * Validates name format
   * @private
   * @param {string} name - Name to validate
   * @returns {boolean} True if valid
   */
  _isValidName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  /**
   * Validates password
   * @private
   * @param {string} password - Password to validate
   * @returns {boolean} True if valid
   */
  _isValidPassword(password) {
    if (!password || typeof password !== 'string') {
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return false;
    }
    if (!/[a-z]/.test(password)) {
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      return false;
    }
    if (!/[0-9]/.test(password)) {
      return false;
    }
    // Cognito special characters: ^ $ * . [ ] { } ( ) ? - " ! @ # % & / \ , > < ' : ; | _ ~ ` + =
    if (!/[\^$*.\[\]{}()?\-"!@#%&/\\,><':;|_~`+=]/.test(password)) {
      return false;
    }
    return true;
  }

  /**
   * Handles login form submission
   * @private
   */
  async _handleLogin() {
    if (this.isLoading) {
      return;
    }

    const emailInput = this.dialogElement.querySelector('#loginEmail');
    const passwordInput = this.dialogElement.querySelector('#loginPassword');
    const submitBtn = this.dialogElement.querySelector('#loginSubmitBtn');

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!this._isValidEmail(email)) {
      emailInput.parentElement.classList.add('invalid');
      emailInput.parentElement.querySelector('output.invalid').textContent = 'Please enter a valid email address.';
      emailInput.focus();
      return;
    }

    if (!password) {
      passwordInput.parentElement.classList.add('invalid');
      passwordInput.parentElement.querySelector('output.invalid').textContent = 'Please enter your password.';
      passwordInput.focus();
      return;
    }

    this.isLoading = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<progress class="circle small"></progress><span>Signing in...</span>';
    submitBtn.disabled = true;

    try {
      await this.authManager.signInWithModal({ email, password });
      const needsEmailVerification = await this.authManager.needsEmailVerification();
      if (needsEmailVerification) {
        this._showConfirmView("");
      } else {
        ui("#authenticationModal");
      }
    } catch (error) {
      console.error('Login failed:', error);
      this._showMessage('Incorrect username or password. Try again.', 'error');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handles signup form submission
   * @private
   */
  async _handleSignup() {
    if (this.isLoading) {
      return;
    }

    const emailInput = this.dialogElement.querySelector('#signupEmail');
    const nameInput = this.dialogElement.querySelector('#signupName');
    const passwordInput = this.dialogElement.querySelector('#signupPassword');
    const confirmPasswordInput = this.dialogElement.querySelector('#signupConfirmPassword');
    const submitBtn = this.dialogElement.querySelector('#signupSubmitBtn');
    const newletterChk = this.dialogElement.querySelector('#signupNewsletter');

    const email = emailInput.value.trim().toLowerCase();
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const newsletter = newletterChk.checked ? '1' : '0';

    if (!this._isValidEmail(email)) {
      emailInput.parentElement.querySelector('output.invalid').textContent = 'Please enter a valid email address.';
      emailInput.parentElement.classList.add('invalid');
      emailInput.focus();
      return;
    }


    if (!this._isValidName(name)) {
      let nameError = "Name is required.";
      if (name.length > 100)
        nameError = "Name must be less than 100 characters long.";
      nameInput.parentElement.querySelector('output.invalid').textContent = nameError;
      nameInput.parentElement.classList.add('invalid');
      nameInput.focus();
      return;
    }

    if (!this._isValidPassword(password)) {
      passwordInput.parentElement.querySelector('output.invalid').innerHTML = 'Password must be at least 8 characters.<br/>Password must contain at least 1 uppercase letter, lowercase letter, number, and symbol.';
      passwordInput.parentElement.classList.add('invalid');
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      confirmPasswordInput.parentElement.querySelector('output.invalid').textContent = 'Passwords do not match.';
      confirmPasswordInput.parentElement.classList.add('invalid');
      confirmPasswordInput.focus();
      return;
    }

    this.isLoading = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<progress class="circle small"></progress><span>Creating account...</span>';
    submitBtn.disabled = true;

    try {
      const result = await this.authManager.signUpWithModal({ email, name, password, newsletter });
      this._showSuccessView(result.message || 'Account created successfully!');
    } catch (error) {
      console.error('Signup failed:', error);
      this._showMessage(error.message || 'Sign up failed. Please try again.', 'error');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handles Google OAuth authentication
   * @private
   */
  async _handleGoogleAuth() {
    if (this.isLoading) {
      return;
    }

    const googleBtn = this.currentMode === 'login'
      ? this.dialogElement.querySelector('#googleLoginBtn')
      : this.dialogElement.querySelector('#googleSignupBtn');

    this.isLoading = true;
    const originalText = googleBtn.innerHTML;
    googleBtn.innerHTML = '<progress class="circle small"></progress><span>Connecting...</span>';
    googleBtn.disabled = true;

    try {
      await this.authManager.signInWithGooglePopup();
      ui("#authenticationModal");
    } catch (error) {
      console.error('Google auth failed:', error);
      this._showMessage(error.message || 'Google sign in failed. Please try again.', 'error');
      googleBtn.innerHTML = originalText;
      googleBtn.disabled = false;
    } finally {
      googleBtn.innerHTML = originalText;
      googleBtn.disabled = false;
      this.isLoading = false;
    }
  }

  /**
   * Shows a message in the modal
   * @private
   * @param {string} message - Message to display
   * @param {string} type - Message type ('success' or 'error')
   */
  _showMessage(message, type) {
    const messageEl = this.dialogElement.querySelector('#authModalMessage');
    if (!messageEl) {
      return;
    }

    const colorClass = type === 'success' ? 'primary-text' : 'error-text';
    const icon = type === 'success' ? 'check_circle' : 'error';

    messageEl.innerHTML = `
      <div class="center-align ${colorClass}">
        <i class="small">${icon}</i>
        <span>${this._escapeHtml(message)}</span>
      </div>
    `;
    messageEl.classList.remove('hidden');
  }

  /**
   * Clears the message area
   * @private
   */
  _clearMessage() {
    const messageEl = this.dialogElement.querySelector('#authModalMessage');
    if (messageEl) {
      messageEl.innerHTML = '';
      messageEl.classList.add('hidden');
    }
  }

  /**
   * Escapes HTML special characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export { AuthenticationModal };
