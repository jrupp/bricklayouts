/**
 * PublicLayoutLoader - Handles loading of public layouts by share code
 * This module is accessible to all users without authentication requirements
 * Follows AirBNB JavaScript style guide
 */

export class PublicLayoutLoader {
  constructor() {
    this.apiBaseUrl = 'https://api.bricklayouts.com'; // Will be configured from CDK outputs
  }

  /**
   * Validates share code format
   * @param {string} shareCode - The share code to validate
   * @returns {boolean} True if valid format (8 characters, letters and numbers only)
   */
  isValidShareCode(shareCode) {
    if (!shareCode || typeof shareCode !== 'string') {
      return false;
    }
    
    // Share code must be exactly 8 characters, uppercase/lowercase letters and numbers only
    const shareCodePattern = /^[A-Za-z0-9]{8}$/;
    return shareCodePattern.test(shareCode);
  }

  /**
   * Loads a public layout by share code
   * @param {string} shareCode - The 8-character share code
   * @returns {Promise<Object>} Promise resolving to layout data or rejecting with error
   */
  async loadPublicLayout(shareCode) {
    // Validate share code format first
    if (!this.isValidShareCode(shareCode)) {
      throw new Error('Invalid share code format. Share code must be 8 characters containing only letters and numbers.');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/public-layouts/${shareCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        throw new Error('Layout not found or is not public');
      }

      if (!response.ok) {
        throw new Error(`Failed to load public layout: ${response.status} ${response.statusText}`);
      }

      const layoutData = await response.json();
      
      // Validate that we received valid layout data
      if (!layoutData || !layoutData.layoutData) {
        throw new Error('Invalid layout data received from server');
      }

      return {
        layoutId: layoutData.layoutId,
        layoutName: layoutData.layoutName,
        layoutData: layoutData.layoutData,
        shareCode: shareCode,
        isPublic: true,
        readOnly: true, // Public layouts are always read-only
        ownerId: layoutData.ownerId,
        createdAt: layoutData.createdAt,
        layoutWidth: layoutData.layoutWidth,
        layoutHeight: layoutData.layoutHeight,
      };
    } catch (error) {
      // Re-throw with more specific error context
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error('Network error: Unable to connect to layout service. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Extracts share code from URL path
   * @param {string} urlPath - The URL path to check
   * @returns {string|null} Share code if found and valid, null otherwise
   */
  extractShareCodeFromPath(urlPath) {
    if (!urlPath || typeof urlPath !== 'string') {
      return null;
    }

    // Remove leading slash and extract potential share code
    const cleanPath = urlPath.replace(/^\/+/, '');
    const pathSegments = cleanPath.split('/');
    
    // Share code should be the first segment in the path
    const potentialShareCode = pathSegments[0];
    
    return this.isValidShareCode(potentialShareCode) ? potentialShareCode : null;
  }

  /**
   * Sets the API base URL (for configuration from CDK outputs)
   * @param {string} baseUrl - The base URL for the API
   */
  setApiBaseUrl(baseUrl) {
    if (typeof baseUrl === 'string' && baseUrl.length > 0) {
      this.apiBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
  }
}
