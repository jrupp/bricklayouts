/**
 * AccountMenuController - Handles the account menu UI component
 * This class is PUBLIC and accessible to all users for showing Login/Sign up options
 * to unauthenticated users and Profile/Logout options to authenticated users.
 */

import { LayoutController } from './layoutController.js';

/**
 * Cached AuthenticationModal module
 * @type {Object|null}
 */
let authModalModule = null;

class AccountMenuController {
  constructor(authManager) {
    this.authManager = authManager;
    this.menuElement = null;
    this.buttonElement = null;
    this.profileModalModule = null; // Cached module import
    this.init();
  }

  /**
   * Initialize the account menu UI
   */
  init() {
    this.createMenuButton();
    this.createDropdownMenu();
    this.updateMenuState();
  }

  /**
   * Create the account_circle button in the top-right corner
   */
  createMenuButton() {
    const accountContainer = document.getElementById('accountMenu-container');
    if (!accountContainer) {
      console.error('accountMenu-container not found');
      return;
    }

    this.buttonElement = document.createElement('button');
    this.buttonElement.id = 'accountMenuButton';
    this.buttonElement.className = 'background border circle large no-margin small-elevate';
    this.buttonElement.title = 'Account';
    this.buttonElement.innerHTML = '<i class="extra">account_circle</i>';

    accountContainer.appendChild(this.buttonElement);
  }

  /**
   * Create the dropdown menu with appropriate options
   */
  createDropdownMenu() {
    this.menuElement = document.createElement('menu');
    this.menuElement.id = 'accountDropdownMenu';
    this.menuElement.className = 'no-wrap extra-text left';

    this.updateMenuItems();

    if (this.buttonElement) {
      this.buttonElement.appendChild(this.menuElement);
    }
  }

  /**
   * Update menu items based on authentication state
   */
  updateMenuItems() {
    if (!this.menuElement) {
      return;
    }

    this.menuElement.innerHTML = '';

    if (this.authManager && this.authManager.isAuthenticated) {
      this.menuElement.innerHTML = `
        <li id="menuProfile" title="View and edit your profile" data-ui="#accountDropdownMenu">
          <i>person</i>Profile
        </li>
        <li id="menuLogout" title="Sign out of your account" data-ui="#accountDropdownMenu">
          <i>logout</i>
          <div>Logout</div>
        </li>
      `;
    } else {
      this.menuElement.innerHTML = `
        <li id="menuLogin" title="Sign in to your account" data-ui="#accountDropdownMenu">
          <i>login</i>
          Login
        </li>
        <li id="menuSignup" title="Create a new account" data-ui="#accountDropdownMenu">
          <i>person_add</i>
          <div>Sign up</div>
        </li>
      `;
    }

    this.attachMenuItemListeners();
  }

  /**
   * Attach event listeners to menu items
   */
  attachMenuItemListeners() {
    const loginItem = document.getElementById('menuLogin');
    const signupItem = document.getElementById('menuSignup');
    const profileItem = document.getElementById('menuProfile');
    const logoutItem = document.getElementById('menuLogout');

    if (loginItem) {
      loginItem.addEventListener('click', () => this.handleLogin());
    }

    if (signupItem) {
      signupItem.addEventListener('click', () => this.handleSignup());
    }

    if (profileItem) {
      profileItem.addEventListener('click', () => this.handleProfile());
    }

    if (logoutItem) {
      logoutItem.addEventListener('click', () => this.handleLogout());
    }
  }

  /**
   * Close the dropdown menu
   */
  closeMenu() {
    this.menuElement?.blur();
  }

  /**
   * Lazily loads and caches the AuthenticationModal module
   * @private
   * @returns {Promise<module>} The AuthenticationModal module
   */
  async _getAuthModalModule() {
    if (!authModalModule) {
      authModalModule = await import('../public-cloud/authenticationModal.js');
    }
    return authModalModule;
  }

  /**
   * Gets the AuthenticationModal singleton instance
   * @private
   * @returns {Promise<AuthenticationModal>} The AuthenticationModal instance
   */
  async _getAuthModal() {
    const module = await this._getAuthModalModule();
    return module.AuthenticationModal.getInstance(this.authManager);
  }

  /**
   * Handle Login click - show authentication modal
   */
  async handleLogin() {
    this.closeMenu();
    try {
      const modal = await this._getAuthModal();
      modal.show('login', async () => {
        const needsEmailVerification = await this.authManager.needsEmailVerification();
        if (needsEmailVerification) {
          // Failed to verify email even after forced to
          await this.authManager.signOut();
          this.authManager.clearCloudFeatures();
        }
        this.updateMenuState();
        await this._loadPrivateCloudFeaturesIfNeeded();
        await this._updateCloudMenuVisibility();
      });
    } catch (error) {
      console.error('Failed to load authentication modal:', error);
    }
  }

  /**
   * Handle Sign up click - show registration modal
   */
  async handleSignup() {
    this.closeMenu();
    try {
      const modal = await this._getAuthModal();
      modal.show('signup', async () => {
        this.updateMenuState();
        await this._loadPrivateCloudFeaturesIfNeeded();
        await this._updateCloudMenuVisibility();
      });
    } catch (error) {
      console.error('Failed to load authentication modal:', error);
    }
  }

  /**
   * Loads private cloud features if user is authenticated with cloud access
   * @private
   */
  async _loadPrivateCloudFeaturesIfNeeded() {
    if (this.authManager && this.authManager.isAuthenticated && this.authManager.hasCloudAccess) {
      try {
        await this.authManager.loadPrivateCloudFeatures();
      } catch (error) {
        console.error('Failed to load private cloud features:', error);
      }
    }
  }

  /**
   * Handle Profile click - dynamically import and open ProfileModal
   */
  async handleProfile() {
    this.closeMenu();
    try {
      // Lazy load and cache the module
      if (!this.profileModalModule) {
        this.profileModalModule = await import('../cloud/profileModal.js');
      }
      const { ProfileModal } = this.profileModalModule;
      const modal = ProfileModal.getInstance(this.authManager);
      modal.show();
      modal.onLogout = async () => {
        await this._logoutCleanup();
      };
    } catch (error) {
      console.error('Failed to load profile modal:', error);
    }
  }

  /**
   * Handle Logout click - sign out without page reload
   */
  async handleLogout() {
    this.closeMenu();
    try {
      if (this.authManager) {
        await this.authManager.signOut();
        this.authManager.clearCloudFeatures();
        await this._logoutCleanup();
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }

  async _logoutCleanup() {
    const layoutController = LayoutController.getInstance();
    if (layoutController && layoutController.isCloudLayout()) {
      layoutController.reset();
    }
    this.updateMenuState();
    await this._updateCloudMenuVisibility();
  }

  /**
   * Updates cloud menu visibility in the layout controller
   * @private
   */
  async _updateCloudMenuVisibility() {
    try {
      const layoutController = LayoutController.getInstance();
      if (layoutController) {
        await layoutController.updateCloudMenuVisibility();
      }
    } catch (error) {
      console.error('Failed to update cloud menu visibility:', error);
    }
  }

  /**
   * Update menu state based on current authentication status
   */
  updateMenuState() {
    this.updateMenuItems();
    this.updateButtonAppearance();
  }

  /**
   * Update button appearance based on authentication state
   */
  updateButtonAppearance() {
    if (!this.buttonElement) {
      return;
    }

    const icon = this.buttonElement.querySelector('i');
    if (icon) {
      if (this.authManager && this.authManager.isAuthenticated) {
        icon.classList.add('fill');
      } else {
        icon.classList.remove('fill');
      }
    }
  }
}

export { AccountMenuController };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccountMenuController };
}
