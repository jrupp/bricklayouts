/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { AuthenticationManager } from '../../src/controller/authenticationController.js';

describe('AuthenticationManager.getCloudStorage', function () {
  let authManager;
  /** Stands in for the private module's CloudStorageManager. */
  class FakeCloudStorageManager {
    constructor(manager) {
      this.authManager = manager;
    }
  }

  beforeEach(function () {
    authManager = new AuthenticationManager();
    authManager.isAuthenticated = true;
    spyOn(authManager, '_importCloudStorageModule')
      .and.callFake(() => Promise.resolve({ CloudStorageManager: FakeCloudStorageManager }));
  });

  it('returns null when nobody is signed in', async function () {
    authManager.isAuthenticated = false;

    expect(await authManager.getCloudStorage()).toBeNull();
    expect(authManager.cloudStorage).toBeNull();
    expect(authManager._importCloudStorageModule).not.toHaveBeenCalled();
  });

  it('gives concurrent callers the same shared manager', async function () {
    const [first, second] = await Promise.all([
      authManager.getCloudStorage(),
      authManager.getCloudStorage(),
    ]);

    expect(first).toEqual(jasmine.any(FakeCloudStorageManager));
    expect(first.authManager).toBe(authManager);
    expect(second).toBe(first);
    expect(authManager.cloudStorage).toBe(first);
    expect(await authManager.getCloudStorage()).toBe(first);
    expect(authManager._importCloudStorageModule).toHaveBeenCalledTimes(1);
  });

  it('does not recreate the manager when a logout lands during the import', async function () {
    const pending = authManager.getCloudStorage();
    // What logout does: drop the auth state and the shared handle.
    authManager.isAuthenticated = false;
    authManager.clearCloudFeatures();

    expect(await pending).toBeNull();
    expect(authManager.cloudStorage).toBeNull();
  });

  it('returns null, and tries again next time, when the module fails to load', async function () {
    spyOn(console, 'error');
    authManager._importCloudStorageModule.and.returnValue(Promise.reject(new Error('offline')));

    expect(await authManager.getCloudStorage()).toBeNull();
    expect(authManager.cloudStorage).toBeNull();

    authManager._importCloudStorageModule
      .and.callFake(() => Promise.resolve({ CloudStorageManager: FakeCloudStorageManager }));
    expect(await authManager.getCloudStorage()).toEqual(jasmine.any(FakeCloudStorageManager));
  });
});
