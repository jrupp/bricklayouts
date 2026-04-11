/**
 * SubscriptionDialogController - Controller for the subscription dialog.
 * Shows messaging about subscription requirements and (in the future)
 * subscription options with Stripe integration.
 * Uses singleton pattern - only one instance exists.
 * Follows AirBNB JavaScript style guide.
 */

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
    this.messageElement = document.getElementById('subscriptionDialogMessage');
  }

  /**
   * Shows the subscription dialog with an optional custom message.
   * @param {string} [message] - Optional message to display at the top of the dialog.
   */
  show(message) {
    if (message && this.messageElement) {
      this.messageElement.textContent = message;
    }
    ui('#subscriptionDialog');
  }
}

export { SubscriptionDialogController };
