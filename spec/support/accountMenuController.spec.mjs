import { AccountMenuController } from '../../src/controller/accountMenuController.js';

function flushPromises() {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('AccountMenuController', () => {
  let container;
  let mockAuthManager;
  let controller;

  function createDOM() {
    const el = document.createElement('div');
    el.id = 'accountMenu-container';
    document.body.appendChild(el);
    return el;
  }

  beforeEach(() => {
    AccountMenuController.resetInstance();
    mockAuthManager = {
      isAuthenticated: false,
      getUserName: jasmine.createSpy('getUserName')
        .and.returnValue(Promise.resolve('TestUser')),
    };
    container = createDOM();
    controller = AccountMenuController.initialize(mockAuthManager);
  });

  afterEach(() => {
    AccountMenuController.resetInstance();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('updateButtonAppearance', () => {
    it('should set title to user name and add fill class when authenticated', async () => {
      mockAuthManager.isAuthenticated = true;
      controller.updateButtonAppearance();
      await flushPromises();

      expect(controller.buttonElement.title).toBe('TestUser');
      const icon = controller.buttonElement.querySelector('i');
      expect(icon.classList.contains('fill')).toBeTrue();
    });

    it('should set title to "Logged in" when getUserName rejects', async () => {
      mockAuthManager.isAuthenticated = true;
      mockAuthManager.getUserName.and.returnValue(
        Promise.reject(new Error('fail'))
      );
      controller.updateButtonAppearance();
      await flushPromises();

      expect(controller.buttonElement.title).toBe('Logged in');
      const icon = controller.buttonElement.querySelector('i');
      expect(icon.classList.contains('fill')).toBeTrue();
    });

    it('should set title to "Account" and remove fill class when not authenticated', () => {
      const icon = controller.buttonElement.querySelector('i');
      icon.classList.add('fill');
      controller.buttonElement.title = 'PreviousUser';

      mockAuthManager.isAuthenticated = false;
      controller.updateButtonAppearance();

      expect(controller.buttonElement.title).toBe('Account');
      expect(icon.classList.contains('fill')).toBeFalse();
    });

    it('should not throw when buttonElement is null', () => {
      controller.buttonElement = null;
      expect(() => controller.updateButtonAppearance()).not.toThrow();
    });
  });
});
