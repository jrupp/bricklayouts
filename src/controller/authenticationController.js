/**
 * AuthenticationManager - Handles all authentication operations with cross-subdomain support
 * This class is accessible to all users for checking authentication state and managing sessions.
 * Implements AWS Cognito integration with Google OAuth and grace period logic.
 * Uses singleton pattern - access via AuthenticationManager.getInstance()
 */

// Lazy load AWS Cognito SDK via script tag (UMD bundle)
let CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute;

async function loadCognitoSDK() {
  if (!CognitoUserPool) {
    // Check if already loaded globally
    if (window.AmazonCognitoIdentity) {
      CognitoUserPool = window.AmazonCognitoIdentity.CognitoUserPool;
      CognitoUser = window.AmazonCognitoIdentity.CognitoUser;
      AuthenticationDetails = window.AmazonCognitoIdentity.AuthenticationDetails;
      CognitoUserAttribute = window.AmazonCognitoIdentity.CognitoUserAttribute;
      return;
    }

    // Load the UMD bundle via script tag
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'src/amazon-cognito-identity.min.js';
      script.onload = () => {
        CognitoUserPool = window.AmazonCognitoIdentity.CognitoUserPool;
        CognitoUser = window.AmazonCognitoIdentity.CognitoUser;
        AuthenticationDetails = window.AmazonCognitoIdentity.AuthenticationDetails;
        CognitoUserAttribute = window.AmazonCognitoIdentity.CognitoUserAttribute;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Cognito SDK'));
      document.head.appendChild(script);
    });
  }
}

class AuthenticationManager {
  /** @type {AuthenticationManager|null} */
  static _instance = null;

  /**
   * Gets the singleton instance of AuthenticationManager
   * @returns {AuthenticationManager}
   */
  static getInstance() {
    if (AuthenticationManager._instance === null) {
      AuthenticationManager._instance = new AuthenticationManager();
    }
    return AuthenticationManager._instance;
  }

  constructor() {
    this.cognitoUser = null;
    this.isAuthenticated = false;
    this.hasCloudAccess = false;
    this.cookieDomain = '.bricklayouts.com'; // Shared across subdomains
    this.cognitoUserPool = null;
    this.config = null;
    this.sdkLoaded = false;
    this.cloudFeatures = null; // Stores loaded private cloud features
  }

  /**
   * Initialize the authentication manager with Cognito configuration
   * Loads configuration from CDK outputs and checks for existing sessions
   */
  async initialize() {
    try {
      // Load configuration from CDK outputs or environment
      await this.loadConfiguration();
      
      // Lazy load Cognito SDK
      await loadCognitoSDK();
      this.sdkLoaded = true;
      
      // Initialize Cognito SDK
      this.initializeCognito();
      
      // Check for existing session in shared cookies or localStorage
      await this.checkExistingSession();
      
      // Handle OAuth callback if present in URL
      await this.handleOAuthCallback();
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
      // Continue with unauthenticated state
    }
  }

  /**
   * Load configuration from hard coded values
   */
  async loadConfiguration() {
    this.config = {
      userPoolId: 'us-east-1_iBimECwbL',
      userPoolClientId: '3vlmiv0ajudfbi94mmtjrtiep1',
      userPoolDomain: 'id.bricklayouts.com',
      apiBaseUrl: 'https://api.bricklayouts.com'
    };
  }

  /**
   * Initialize Cognito SDK with loaded configuration
   */
  initializeCognito() {
    if (!this.sdkLoaded) {
      console.warn('Cognito SDK not loaded yet');
      return;
    }

    const poolData = {
      UserPoolId: this.config.userPoolId,
      ClientId: this.config.userPoolClientId
    };
    
    this.cognitoUserPool = new CognitoUserPool(poolData);
  }

  /**
   * Check for existing authentication session in shared cookies or localStorage
   */
  async checkExistingSession() {
    try {
      if (!this.cognitoUserPool) {
        return;
      }

      // Get current user from Cognito User Pool
      const currentUser = this.cognitoUserPool.getCurrentUser();
      
      if (currentUser) {
        // Get session to validate tokens
        await new Promise((resolve, reject) => {
          currentUser.getSession((err, session) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (session && session.isValid()) {
              this.cognitoUser = currentUser;
              this.isAuthenticated = true;
              
              // Store tokens in shared cookies for cross-subdomain access
              const idToken = session.getIdToken().getJwtToken();
              const accessToken = session.getAccessToken().getJwtToken();
              const refreshToken = session.getRefreshToken().getToken();
              
              this.setSharedDomainCookie('cognitoIdToken', idToken, 'path=/; secure; samesite=strict');
              this.setSharedDomainCookie('cognitoAccessToken', accessToken, 'path=/; secure; samesite=strict');
              this.setSharedDomainCookie('cognitoRefreshToken', refreshToken, 'path=/; secure; samesite=strict');
              
              // Wait for cloud access check to complete before resolving
              this.updateCloudAccess().then(() => resolve()).catch(() => resolve());
            } else {
              reject(new Error('Invalid session'));
            }
          });
        });
      }
    } catch (error) {
      console.warn('Failed to restore existing session:', error);
      // Continue with unauthenticated state
    }
  }

  /**
   * Handle modal-based sign-in flow
   * @param {Object} credentials - { email, password }
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async signInWithModal(credentials) {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        const authenticationData = {
          Username: credentials.email,
          Password: credentials.password
        };
        
        const authenticationDetails = new AuthenticationDetails(authenticationData);
        
        const userData = {
          Username: credentials.email,
          Pool: this.cognitoUserPool
        };
        
        const cognitoUser = new CognitoUser(userData);
        
        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: async (session) => {
            this.cognitoUser = cognitoUser;
            this.isAuthenticated = true;
            
            // Set cookies with shared domain for cross-subdomain access
            const idToken = session.getIdToken().getJwtToken();
            const accessToken = session.getAccessToken().getJwtToken();
            const refreshToken = session.getRefreshToken().getToken();
            
            this.setSharedDomainCookie('cognitoIdToken', idToken, 'path=/; secure; samesite=strict');
            this.setSharedDomainCookie('cognitoAccessToken', accessToken, 'path=/; secure; samesite=strict');
            this.setSharedDomainCookie('cognitoRefreshToken', refreshToken, 'path=/; secure; samesite=strict');
            
            // Wait for cloud access check to complete before resolving
            await this.updateCloudAccess();
            
            resolve({ success: true });
          },
          
          onFailure: (err) => {
            reject(new Error(err.message || 'Authentication failed'));
          },
          
          newPasswordRequired: (userAttributes, requiredAttributes) => {
            // Handle new password requirement if needed
            reject(new Error('New password required. Please contact support at hello@bricklayouts.com'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle modal-based user registration
   * @param {Object} userDetails - { email, name, password, newsletter }
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async signUpWithModal(userDetails) {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        // Validate input
        if (!userDetails.email || !userDetails.name || !userDetails.password) {
          reject(new Error('All fields are required'));
          return;
        }

        // Set grace period expiry to 24 hours from now
        const gracePeriodExpiry = new Date();
        gracePeriodExpiry.setHours(gracePeriodExpiry.getHours() + 24);

        const attributeList = [
          new CognitoUserAttribute({
            Name: 'email',
            Value: userDetails.email
          }),
          new CognitoUserAttribute({
            Name: 'given_name',
            Value: userDetails.name
          }),
          new CognitoUserAttribute({
            Name: 'custom:grace_period_expires',
            Value: gracePeriodExpiry.toISOString()
          })
        ];

        const otherData = [
          new CognitoUserAttribute({
            Name: 'newsletter',
            Value: userDetails.newsletter || '0'
          })
        ];

        this.cognitoUserPool.signUp(
          userDetails.email,
          userDetails.password,
          attributeList,
          otherData,
          (err, result) => {
            if (err) {
              reject(new Error(err.message || 'Sign up failed'));
              return;
            }

            // Store the email for verification
            this.pendingVerificationEmail = userDetails.email;
            this.pendingVerificationPassword = userDetails.password;

            // Automatically sign in the user after successful registration.
            // The pre-signup Lambda auto-confirms users, so this should work.
            this.signInWithModal({
              email: userDetails.email,
              password: userDetails.password
            }).then(() => {
              // Auto-confirming the user suppresses Cognito's automatic
              // verification email. We must explicitly request one via
              // getAttributeVerificationCode now that the user is signed in.
              this.cognitoUser.getAttributeVerificationCode('email', {
                onSuccess: () => {
                  resolve({
                    success: true,
                    message: 'Account created! Check your email for a verification code. You can use all features for 24 hours.',
                    needsVerification: true
                  });
                },
                onFailure: (verifyErr) => {
                  console.warn('Failed to send verification email:', verifyErr);
                  // Sign-up and sign-in succeeded, just couldn't send the
                  // verification email. User can request it again later.
                  resolve({
                    success: true,
                    message: 'Account created! You can use all features for 24 hours. Please request a verification code from your profile.',
                    needsVerification: true
                  });
                }
              });
            }).catch((signInErr) => {
              // Registration succeeded but auto sign-in failed
              // This might happen if pre-signup Lambda isn't deployed yet
              resolve({
                success: true,
                message: 'Account created! Please check your email for a verification code.',
                needsVerification: true
              });
            });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Verify email attribute using a verification code.
   * Since the account is auto-confirmed by the PreSignUp Lambda, we use
   * verifyAttribute (not confirmRegistration) to verify the email address.
   * Requires an authenticated session.
   * @param {string} code - 6-digit verification code
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async confirmSignUp(code) {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    if (!this.cognitoUser) {
      throw new Error('You must be signed in to verify your email. Please sign in first.');
    }

    return new Promise((resolve, reject) => {
      this.cognitoUser.verifyAttribute('email', code, {
        onSuccess: (result) => {
          resolve({ success: true, message: 'Email verified successfully!' });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Verification failed'));
        }
      });
    });
  }

  /**
   * Request a new email verification code.
   * Since the account is auto-confirmed, resendConfirmationCode won't work.
   * Uses getAttributeVerificationCode instead. Requires an authenticated session.
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async resendVerificationCode() {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    if (!this.cognitoUser) {
      throw new Error('You must be signed in to request a verification code. Please sign in first.');
    }

    return new Promise((resolve, reject) => {
      this.cognitoUser.getAttributeVerificationCode('email', {
        onSuccess: () => {
          resolve({ success: true, message: 'Verification code sent!' });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Failed to resend code'));
        }
      });
    });
  }

  /**
   * Handle Google OAuth in popup window
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async signInWithGooglePopup() {
    return new Promise((resolve, reject) => {
      try {
        // Build OAuth URL for Google sign-in with authorization code flow.
        // Authorization code flow (unlike implicit) returns a refresh token,
        // which is required for session persistence across page reloads.
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth-popup-callback.html`);
        const oauthUrl = `https://${this.config.userPoolDomain}/oauth2/authorize?` +
          `response_type=code&` +
          `client_id=${this.config.userPoolClientId}&` +
          `redirect_uri=${redirectUri}&` +
          `scope=openid+email+profile+aws.cognito.signin.user.admin&` +
          `identity_provider=Google`;

        // Open popup window for OAuth
        const popup = window.open(
          oauthUrl,
          'googleAuth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
          reject(new Error('Popup blocked. Please allow popups for this site.'));
          return;
        }

        // Listen for messages from popup callback
        const messageHandler = async (event) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', messageHandler);

            const { code } = event.data;

            // Exchange authorization code for tokens (including refresh token)
            await this.exchangeCodeForTokens(code);

            resolve({ success: true });
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', messageHandler);
            reject(new Error(event.data.error || 'OAuth authentication failed'));
          }
        };

        window.addEventListener('message', messageHandler);

        // Check if popup was closed without completing auth
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);

            // Check if authentication succeeded before popup closed
            if (!this.isAuthenticated) {
              reject(new Error('Authentication cancelled'));
            }
          }
        }, 1000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          if (!popup.closed) {
            popup.close();
          }
          if (!this.isAuthenticated) {
            reject(new Error('Authentication timeout'));
          }
        }, 300000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle OAuth callback from redirect or popup
   * Extracts authorization code from URL params or tokens from hash
   */
  async handleOAuthCallback() {
    try {
      // Check for authorization code in query params (code flow)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        await this.exchangeCodeForTokens(code);
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      // Legacy: check for tokens in hash (implicit flow, used by popup callback page)
      const hash = window.location.hash;

      if (!hash || hash.length === 0) {
        return;
      }

      // Parse hash parameters
      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');

      if (idToken && accessToken) {
        // Check if this is a popup callback
        if (window.opener && window.location.pathname.includes('popup-callback')) {
          // Send tokens to parent window
          window.opener.postMessage({
            type: 'oauth-success',
            idToken: idToken,
            accessToken: accessToken
          }, window.location.origin);

          // Close popup
          window.close();
          return;
        }

        // Regular redirect callback - set up user session
        await this.setupUserFromTokens(idToken, accessToken);

        // Clean up URL hash
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error);

      // If in popup, notify parent of error
      if (window.opener && window.location.pathname.includes('popup-callback')) {
        window.opener.postMessage({
          type: 'oauth-error',
          error: error.message
        }, window.location.origin);
        window.close();
      }
    }
  }

  /**
   * Exchange an authorization code for tokens via the Cognito /oauth2/token endpoint,
   * then store the full session (including refresh token) into the Cognito SDK's
   * localStorage so that getCurrentUser() / getSession() work on page reload.
   * @param {string} code - Authorization code from OAuth callback
   * @private
   */
  async exchangeCodeForTokens(code) {
    const redirectUri = `${window.location.origin}/auth-popup-callback.html`;
    const tokenEndpoint = `https://${this.config.userPoolDomain}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.userPoolClientId,
      code: code,
      redirect_uri: redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await response.json();
    const { id_token: idToken, access_token: accessToken, refresh_token: refreshToken } = tokens;

    // Parse the ID token to get the username
    const payload = this.parseJWT(idToken);
    const username = payload['cognito:username'] || payload['sub'];

    // Store tokens into the Cognito SDK's localStorage format so that
    // getCurrentUser() and getSession() work on subsequent page loads.
    const keyPrefix = `CognitoIdentityServiceProvider.${this.config.userPoolClientId}`;
    localStorage.setItem(`${keyPrefix}.LastAuthUser`, username);
    localStorage.setItem(`${keyPrefix}.${username}.idToken`, idToken);
    localStorage.setItem(`${keyPrefix}.${username}.accessToken`, accessToken);
    localStorage.setItem(`${keyPrefix}.${username}.refreshToken`, refreshToken);

    // Now getCurrentUser() will find this user
    const currentUser = this.cognitoUserPool.getCurrentUser();
    this.cognitoUser = currentUser;
    this.isAuthenticated = true;

    // Store tokens in shared cookies for cross-subdomain access
    this.setSharedDomainCookie('cognitoIdToken', idToken, 'path=/; secure; samesite=strict');
    this.setSharedDomainCookie('cognitoAccessToken', accessToken, 'path=/; secure; samesite=strict');
    this.setSharedDomainCookie('cognitoRefreshToken', refreshToken, 'path=/; secure; samesite=strict');

    // Wait for cloud access check to complete
    await this.updateCloudAccess();
  }

  /**
   * Set up Cognito user from OAuth tokens (implicit flow fallback, no refresh token)
   * @param {string} idToken - ID token from OAuth
   * @param {string} accessToken - Access token from OAuth
   * @private
   */
  async setupUserFromTokens(idToken, accessToken) {
    try {
      // Parse token to get username
      const payload = this.parseJWT(idToken);
      const username = payload['cognito:username'] || payload['email'];
      
      // Create Cognito user object
      const userData = {
        Username: username,
        Pool: this.cognitoUserPool
      };
      
      this.cognitoUser = new CognitoUser(userData);
      this.isAuthenticated = true;
      
      // Store tokens in shared cookies for cross-subdomain access
      this.setSharedDomainCookie('cognitoIdToken', idToken, 'path=/; secure; samesite=strict');
      this.setSharedDomainCookie('cognitoAccessToken', accessToken, 'path=/; secure; samesite=strict');
      
      // Also store in localStorage as backup
      localStorage.setItem('cognitoIdToken', idToken);
      localStorage.setItem('cognitoAccessToken', accessToken);
      
      // Wait for cloud access check to complete
      await this.updateCloudAccess();
    } catch (error) {
      console.error('Failed to setup user from tokens:', error);
      throw error;
    }
  }

  /**
   * Check if user has cloud access based on JWT groups and grace period logic
   * @returns {Promise<boolean>} True if user has cloud access
   */
  async hasCloudAccessAsync() {
    if (!this.isAuthenticated) {
      return false;
    }

    // Check user permissions for cloud storage using JWT groups
    //const groups = await this.getUserGroups();
    //if (!groups.includes('cloud-users')) {
    //  return false;
    //}

    const emailVerified = await this.getEmailVerified();
    if (emailVerified) {
      return true;
    }

    // Check grace period for unverified emails
    const gracePeriodExpires = await this.getGracePeriodExpiry();
    return gracePeriodExpires && new Date() < new Date(gracePeriodExpires);
  }

  /**
   * Extract email verification status from JWT token
   * @returns {Promise<boolean>} True if email is verified
   */
  async getEmailVerified() {
    if (!this.cognitoUser) {
      return false;
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return false;
    }

    const payload = this.parseJWT(idToken);
    return payload['email_verified'] === true;
  }

  /**
   * Extract grace period expiry from JWT token custom attributes
   * @returns {Promise<string|null>} Grace period expiry timestamp or null
   */
  async getGracePeriodExpiry() {
    if (!this.cognitoUser) {
      return null;
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return null;
    }

    const payload = this.parseJWT(idToken);
    return payload['custom:grace_period_expires'] || null;
  }

  /**
   * Extract user's name from JWT token
   * @returns {Promise<string|null>} User's name or null
   */
  async getUserName() {
    if (!this.cognitoUser) {
      return null;
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return null;
    }

    const payload = this.parseJWT(idToken);
    return payload['given_name'] || null; // Single name field stored in given_name
  }

  /**
   * Extract user's email from JWT token
   * @returns {Promise<string|null>} User's email or null
   */
  async getUserEmail() {
    if (!this.cognitoUser) {
      return null;
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return null;
    }

    const payload = this.parseJWT(idToken);
    return payload['email'] || null;
  }

  /**
   * Check if user signed in via social provider (Google)
   * @returns {Promise<boolean>} True if social login user
   */
  async isSocialLoginUser() {
    if (!this.cognitoUser) {
      return false;
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return false;
    }

    const payload = this.parseJWT(idToken);
    const identities = payload['identities'] || [];
    return identities.some(identity => identity.providerType === 'Google');
  }

  /**
   * Update user profile information
   * @param {string} name - New name
   * @param {string} email - New email
   * @returns {Promise} Result of update operation
   */
  async updateProfile(name, email) {
    try {
      if (!this.cognitoUser) {
        throw new Error('No authenticated user');
      }

      const currentName = await this.getUserName();
      const currentEmail = await this.getUserEmail();
      const attributes = [];

      if (name !== currentName) {
        attributes.push(new CognitoUserAttribute({ Name: 'given_name', Value: name }));
      }

      if (email !== currentEmail) {
        attributes.push(new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() }));
        // Email change requires verification - original email stays active until verified
      }

      if (attributes.length > 0) {
        await new Promise((resolve, reject) => {
          this.cognitoUser.updateAttributes(attributes, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        
        // Refresh session to get updated claims
        await this.refreshSession();
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Change user password (not available for social login users)
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise} Result of password change
   */
  async changePassword(currentPassword, newPassword) {
    const isSocial = await this.isSocialLoginUser();
    if (isSocial) {
      return { success: false, error: 'Password change not available for social login users' };
    }

    try {
      if (!this.cognitoUser) {
        throw new Error('No authenticated user');
      }

      await new Promise((resolve, reject) => {
        this.cognitoUser.changePassword(currentPassword, newPassword, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Permanently delete user account and all associated data
   * @returns {Promise} Result of account deletion
   */
  async deleteAccount() {
    try {
      if (!this.cognitoUser) {
        throw new Error('No authenticated user');
      }

      // First delete all user layouts via API
      await this.deleteAllUserLayouts();

      // Then delete the Cognito user account
      await new Promise((resolve, reject) => {
        this.cognitoUser.deleteUser((err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      // Clear local session
      await this.signOut();
      this.clearCloudFeatures();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Call backend API to soft delete all user layouts and remove public status
   * @returns {Promise} Result of layout deletion
   */
  async deleteAllUserLayouts() {
    const token = await this.getIdTokenForApi();
    const response = await fetch(`${this.config.apiBaseUrl}/users/delete-all-layouts`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete user layouts');
    }
  }

  /**
   * Refresh JWT tokens to get updated user attributes
   * @returns {Promise} Refreshed session
   */
  async refreshSession() {
    if (!this.cognitoUser) {
      throw new Error('No authenticated user');
    }

    return new Promise((resolve, reject) => {
      this.cognitoUser.getSession(async (err, session) => {
        if (err) {
          reject(err);
        } else {
          const refreshToken = session.getRefreshToken();
          this.cognitoUser.refreshSession(refreshToken, async (err, newSession) => {
            if (err) {
              reject(err);
              return;
            }
            // Update stored tokens in cookies
            const idToken = newSession.getIdToken().getJwtToken();
            const accessToken = newSession.getAccessToken().getJwtToken();
            const newRefreshToken = newSession.getRefreshToken().getToken();
            
            this.setSharedDomainCookie('cognitoIdToken', idToken, 'path=/; secure; samesite=strict');
            this.setSharedDomainCookie('cognitoAccessToken', accessToken, 'path=/; secure; samesite=strict');
            this.setSharedDomainCookie('cognitoRefreshToken', newRefreshToken, 'path=/; secure; samesite=strict');
            
            // Update cloud access status and wait for it to complete
            await this.updateCloudAccess();
            
            resolve(newSession);
          });
        }
      });
    });
  }

  /**
   * Check if user needs to verify email (unverified and grace period expired)
   * @returns {Promise<boolean>} True if email verification is needed
   */
  async needsEmailVerification() {
    if (!this.isAuthenticated) {
      return false;
    }
    const emailVerified = await this.getEmailVerified();
    if (emailVerified) {
      return false;
    }

    const gracePeriodExpires = await this.getGracePeriodExpiry();
    if (!gracePeriodExpires) {
      return true;
    }

    return new Date() >= new Date(gracePeriodExpires);
  }

  /**
   * Sign out user and clear session
   * Clear session from both localStorage and shared cookies
   * Reset authentication state without page reload
   */
  async signOut() {
    if (this.cognitoUser) {
      this.cognitoUser.signOut(function () {});
    }

    // Clear authentication state
    this.cognitoUser = null;
    this.isAuthenticated = false;
    this.hasCloudAccess = false;

    // Clear shared domain cookies
    this.clearSharedDomainCookies();

    // Clear localStorage
    localStorage.removeItem('cognitoIdToken');
    localStorage.removeItem('cognitoAccessToken');
    localStorage.removeItem('cognitoRefreshToken');
  }

  /**
   * Return JWT ID token for API calls
   * NOTE: API Gateway Cognito authorizer expects ID tokens, not access tokens.
   * @returns {Promise<string|null>} ID token for API calls or null
   */
  getIdTokenForApi() {
    if (!this.cognitoUser) {
      return null;
    }

    return new Promise((resolve) => {
      this.cognitoUser.getSession((err, session) => {
        if (err || !session) {
          // Fallback to cookie
          const token = this.getTokenFromSharedCookie('cognitoIdToken');
          resolve(token);
        } else {
          resolve(session.getIdToken().getJwtToken());
        }
      });
    });
  }

  /**
   * Return JWT ID token for parsing user information
   * @returns {Promise<string|null>} ID token or null
   */
  getIdToken() {
    // Delegate to getIdTokenForApi since they return the same token
    return this.getIdTokenForApi();
  }

  /**
   * Check user permissions for specific features using JWT groups
   * @param {string} feature - Feature name to check
   * @returns {Promise<boolean>} True if user has access to feature
   */
  async hasFeatureAccess(feature) {
    const groups = await this.getUserGroups();

    switch (feature) {
      case 'cloud-storage':
        //return groups.includes('cloud-users');
        return this.hasCloudAccessAsync();
      case 'admin':
        return groups.includes('admin');
      case 'subscription':
        return groups.includes('subscription');
      default:
        return false;
    }
  }

  /**
   * Extract groups from JWT token cognito:groups claim
   * @returns {Promise<Array>} Array of group names
   */
  async getUserGroups() {
    if (!this.cognitoUser) {
      return [];
    }

    const idToken = await this.getIdToken();
    if (!idToken) {
      return [];
    }

    const payload = this.parseJWT(idToken);
    return payload['cognito:groups'] || [];
  }

  /**
   * Parse JWT token to extract claims
   * @param {string} token - JWT token to parse
   * @returns {Object} Parsed JWT payload
   */
  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to parse JWT token:', error);
      return {};
    }
  }

  /**
   * Set cookie with domain=.bricklayouts.com for cross-subdomain access
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {string} options - Additional cookie options
   */
  setSharedDomainCookie(name, value, options = '') {
    document.cookie = `${name}=${value}; domain=${this.cookieDomain}; ${options}`;
  }

  /**
   * Retrieve authentication token from shared domain cookie
   * @param {string} tokenType - Type of token to retrieve (default: 'cognitoIdToken')
   * @returns {string|null} Token value or null
   */
  getTokenFromSharedCookie(tokenType = 'cognitoIdToken') {
    const name = tokenType + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  }

  /**
   * Clear all authentication-related cookies from shared domain
   */
  clearSharedDomainCookies() {
    const cookiesToClear = ['cognitoIdToken', 'cognitoAccessToken', 'cognitoRefreshToken'];
    
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; domain=${this.cookieDomain}; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
  }

  /**
   * Update cloud access status based on current authentication state
   * @private
   */
  async updateCloudAccess() {
    this.hasCloudAccess = await this.hasCloudAccessAsync();
  }

  /**
   * Dynamically loads PRIVATE cloud features after authentication and authorization checks.
   * This method should only be called after verifying the user is authenticated and has cloud access.
   *
   * IMPORTANT: This method loads PRIVATE cloud modules only:
   * - cloudStorageController.js - Cloud storage operations
   * - fileDialogController.js - Cloud file dialog
   * - profileModal.js - Profile management modal
   *
   * PUBLIC authentication UI (AccountMenu, AuthenticationModal) is imported directly
   * in the main application without auth checks, as they are needed for login/signup.
   *
   * @returns {Promise<Object|null>} Object with cloud features or null if not authorized
   */
  async loadPrivateCloudFeatures() {
    // Verify authentication first
    if (!this.isAuthenticated) {
      console.warn('Cannot load private cloud features: User is not authenticated');
      return null;
    }

    // Verify cloud access authorization
    if (!this.hasCloudAccess) {
      console.warn('Cannot load private cloud features: User does not have cloud access');
      return null;
    }

    // Return cached features if already loaded
    if (this.cloudFeatures) {
      return this.cloudFeatures;
    }

    try {
      // Import LayoutController to get the instance
      const { LayoutController } = await import('./layoutController.js');
      const layoutController = LayoutController.getInstance();

      // Dynamically import PRIVATE cloud modules
      const [
        { CloudStorageManager },
        { FileDialog },
        { ProfileModal }
      ] = await Promise.all([
        import('../cloud/cloudStorageController.js'),
        import('../cloud/fileDialogController.js'),
        import('../cloud/profileModal.js')
      ]);

      // Initialize private cloud features
      const cloudStorage = new CloudStorageManager(this);
      const fileDialog = new FileDialog(cloudStorage, layoutController);
      const profileModal = ProfileModal.getInstance(this);

      this.cloudFeatures = {
        cloudStorage,
        fileDialog,
        profileModal
      };

      return this.cloudFeatures;
    } catch (error) {
      console.error('Failed to load private cloud features:', error);
      return null;
    }
  }

  /**
   * Initiate forgot password flow - sends verification code to email
   * Does NOT require authentication. Creates a temporary CognitoUser for the request.
   * @param {string} email - User's email address
   * @returns {Promise} Resolves on success (or if user not found, for security)
   */
  async forgotPassword(email) {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    const userData = {
      Username: email,
      Pool: this.cognitoUserPool
    };

    const cognitoUser = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          resolve({ success: true, codeDeliveryDetails: data });
        },
        onFailure: (err) => {
          if (err.code === 'UserNotFoundException') {
            resolve({ success: true, suppressed: true });
            return;
          }
          reject(new Error(err.message || 'Failed to initiate password reset'));
        },
        inputVerificationCode: (data) => {
          resolve({ success: true, codeDeliveryDetails: data });
        }
      });
    });
  }

  /**
   * Confirm forgot password with verification code and new password
   * Does NOT require authentication. Creates a temporary CognitoUser for the request.
   * @param {string} email - User's email address
   * @param {string} verificationCode - 6-digit verification code
   * @param {string} newPassword - New password
   * @returns {Promise} Resolves on success, rejects on failure
   */
  async confirmForgotPassword(email, verificationCode, newPassword) {
    if (!this.sdkLoaded || !this.cognitoUserPool) {
      throw new Error('Cognito SDK not initialized');
    }

    const userData = {
      Username: email,
      Pool: this.cognitoUserPool
    };

    const cognitoUser = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.confirmPassword(verificationCode, newPassword, {
        onSuccess: () => {
          resolve({ success: true });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Password reset failed'));
        }
      });
    });
  }

  /**
   * Clears loaded private cloud features (called on logout)
   */
  clearCloudFeatures() {
    if (this.cloudFeatures?.fileDialog) {
      this.cloudFeatures.fileDialog.destroy();
    }
    this.cloudFeatures = null;
  }

  /**
   * Gets the loaded private cloud features
   * @returns {Object|null} Cloud features or null if not loaded
   */
  getCloudFeatures() {
    return this.cloudFeatures;
  }

}

// Export for use in other modules
export default AuthenticationManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthenticationManager;
}