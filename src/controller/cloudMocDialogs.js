/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

/**
 * Dialogs belonging to the cloud MOC sync flow: the prompt shown before local-only
 * MOCs are uploaded, the explanation shown when the server refuses a delete, and
 * the upsell shown when a free account runs out of cloud MOC storage.
 *
 * These render cloud data but never call the API, so they stay in the public repo
 * alongside their DOM specs. Nothing reaches them except cloudMocSync.js, which is
 * itself only loaded once the user is known to be signed in, so a signed-out
 * visitor never downloads them.
 *
 * All of them are built at runtime rather than declared in index.html, so the
 * "404.html must match index.html" rule is not dragged in. Everything rendered
 * here is attacker-controlled -- MOC names come straight out of a local layout
 * file and the refusal details come from the server -- so every value is inserted
 * with textContent, never innerHTML.
 *
 * This module deliberately has no imports, so it cannot take part in a cycle.
 * Follows AirBNB JavaScript style guide.
 */

/** @typedef {import('../cloud/cloudStorageController.js').CloudStorageError} CloudStorageError */

/**
 * A prompt on screen, kept so that a second call can retire it first.
 * @typedef {Object} ActivePrompt
 * @property {HTMLDialogElement} dialog
 * @property {function(): void} settle Removes the dialog and resolves its
 *   caller with the answer given so far, which defaults to the negative one.
 *   Safe to call more than once.
 */

/** @type {?ActivePrompt} */
let activeUploadPrompt = null;
/** @type {?ActivePrompt} */
let activeLimitPrompt = null;

/**
 * Closes a prompt that a newer call is about to replace, through BeerCSS just as
 * its own buttons do, so that its overlay is released and its caller is settled
 * with the default answer rather than left waiting. Removing it outright would
 * strand both.
 * @param {ActivePrompt} prompt
 * @returns {Promise<void>} Settles once the old prompt is gone
 */
async function retirePrompt(prompt) {
  const { dialog } = prompt;
  if (!dialog.open) {
    // Still opening: BeerCSS decides between opening and closing before its
    // opening delay, so toggling it now would open it a second time.
    await new Promise((resolve) => { setTimeout(resolve, 100); });
  }
  if (dialog.isConnected && dialog.open) {
    await new Promise((resolve) => {
      dialog.addEventListener('close', resolve, { once: true });
      ui(dialog);
    });
  }
  // A fallback for a dialog that never opened; a no-op once it has closed.
  prompt.settle();
}

/**
 * Prompt the user to upload local-only MOCs before saving the layout to the
 * cloud.
 * @param {Array<String>} names Display names of the MOCs that are not in the cloud
 * @returns {Promise<Boolean>} True if the user chose to continue
 */
export function confirmUploadMocs(names) {
  if (activeUploadPrompt && !activeUploadPrompt.dialog.isConnected) {
    // Taken out of the page by something else; nothing left to close.
    activeUploadPrompt.settle();
  }
  if (activeUploadPrompt) {
    // The earlier caller is told "No", so only one of them uploads.
    return retirePrompt(activeUploadPrompt).then(() => confirmUploadMocs(names));
  }
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'no-padding border large-width surface-container-high small-round';
    dialog.id = 'uploadMocsDialog';
    dialog.innerHTML = `
        <div>
          <header class="fill top-round small-round small-padding right-padding" style="min-block-size: 3.2rem;">
            <nav>
              <h6 class="max">MOCs Not Saved to the Cloud</h6>
              <button class="circle medium transparent" data-ui="#uploadMocsDialog">
                <i class="medium bold">close</i>
              </button>
            </nav>
          </header>
          <div class="small-padding horizontal-padding extra-text">
            <p id="uploadMocsMessage"></p>
            <p>To continue, these MOCs will be saved to your cloud account. Do you want to continue?</p>
          </div>
          <hr>
          <nav class="no-padding no-space no-margin">
            <button class="no-round max extra-text left-button primary-text" id="uploadMocsConfirm"><span>Yes</span></button>
            <button class="no-round max extra-text right-button error" id="uploadMocsCancel"><span>No</span></button>
          </nav>
        </div>
      `;
    const message = `This layout contains ${names.length} MOC(s) that are not currently `
      + `stored in your account: ${names.join(', ')}.`;
    dialog.querySelector('#uploadMocsMessage').textContent = message;
    document.body.appendChild(dialog);

    let outcome = false;
    let settled = false;
    const prompt = {
      dialog,
      settle: () => {
        if (settled) return;
        settled = true;
        dialog.remove();
        if (activeUploadPrompt === prompt) {
          activeUploadPrompt = null;
        }
        resolve(outcome);
      },
    };
    activeUploadPrompt = prompt;
    dialog.addEventListener('close', prompt.settle);
    const closeDialog = () => ui('#uploadMocsDialog');
    dialog.querySelector('#uploadMocsConfirm').addEventListener('click', () => {
      outcome = true;
      closeDialog();
    });
    dialog.querySelector('#uploadMocsCancel').addEventListener('click', () => {
      outcome = false;
      closeDialog();
    });

    ui('#uploadMocsDialog');
  });
}

/**
 * Tell the user their account has no room for another cloud MOC, and offer the
 * upgrade. The MOC itself is already committed by the time this shows, but only
 * to this page's memory, so the text says how long that lasts.
 * The text is static, so nothing here needs escaping.
 * @returns {Promise<Boolean>} True if the user chose to subscribe. Resolved on the
 *   dialog's `close` event, so it is gone before the caller opens another one.
 */
export function showMocLimitDialog() {
  if (activeLimitPrompt && !activeLimitPrompt.dialog.isConnected) {
    activeLimitPrompt.settle();
  }
  if (activeLimitPrompt) {
    return retirePrompt(activeLimitPrompt).then(() => showMocLimitDialog());
  }
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'no-padding border large-width surface-container-high small-round';
    dialog.id = 'mocLimitDialog';
    dialog.innerHTML = `
        <div>
          <header class="fill top-round small-round small-padding right-padding"
            style="min-block-size: 3.2rem;">
            <nav>
              <h6 class="max">Cloud Storage Full</h6>
              <button class="circle medium transparent" data-ui="#mocLimitDialog">
                <i class="medium bold">close</i>
              </button>
            </nav>
          </header>
          <div class="small-padding horizontal-padding extra-text">
            <p>Your MOC is available until you close BrickLayouts. It will be lost if you
              refresh or close the page, unless you place it in a layout and download that
              layout. Upgrade to store it in the cloud.</p>
            <p>Free accounts may only store 10 MOCs in the cloud. To store more MOCs in the
              cloud, please upgrade your subscription.</p>
          </div>
          <hr>
          <nav class="no-padding no-space no-margin">
            <button class="no-round max extra-text left-button primary-text"
              id="mocLimitSubscribe"><span>Subscribe</span></button>
            <button class="no-round max extra-text right-button primary-text"
              id="mocLimitOk"><span>OK</span></button>
          </nav>
        </div>
      `;
    document.body.appendChild(dialog);

    let subscribe = false;
    let settled = false;
    const prompt = {
      dialog,
      settle: () => {
        if (settled) return;
        settled = true;
        dialog.remove();
        if (activeLimitPrompt === prompt) {
          activeLimitPrompt = null;
        }
        resolve(subscribe);
      },
    };
    activeLimitPrompt = prompt;
    dialog.addEventListener('close', prompt.settle);
    const closeDialog = () => ui('#mocLimitDialog');
    dialog.querySelector('#mocLimitSubscribe').addEventListener('click', () => {
      subscribe = true;
      closeDialog();
    });
    dialog.querySelector('#mocLimitOk').addEventListener('click', closeDialog);

    ui('#mocLimitDialog');
  });
}

/**
 * Explain a cloud refusal to delete a MOC, naming the caller's own layouts that
 * still reference it. Everything here is server-supplied, so it is rendered with
 * textContent and must tolerate a missing or malformed `details` payload.
 * @param {function(String, String, function(HTMLElement): void): Promise<void>} showNotice
 *   The dismiss-only dialog builder, passed in so this module stays import-free
 * @param {String} name The MOC's display name
 * @param {CloudStorageError} error The MOC_IN_USE error
 * @returns {Promise<void>}
 */
export function showMocBlockedDialog(showNotice, name, error) {
  return showNotice('mocBlockedDialog', 'Cannot Delete MOC', (body) => {
    const lead = document.createElement('p');
    lead.textContent = error?.message
      || `"${name}" is still used by one or more layouts.`;
    body.appendChild(lead);

    const details = error?.details;
    if (!details || typeof details !== 'object') {
      return;
    }

    if (Array.isArray(details.layouts) && details.layouts.length > 0) {
      const scroll = document.createElement('div');
      scroll.className = 'scroll';
      scroll.style.maxBlockSize = '40vh';
      const list = document.createElement('ul');
      list.className = 'list border';
      details.layouts.forEach((layout) => {
        const item = document.createElement('li');
        item.textContent = layout?.layoutName || layout?.layoutId || '';
        list.appendChild(item);
      });
      scroll.appendChild(list);
      body.appendChild(scroll);
    }

    if (details.otherOwnerCount > 0) {
      const shared = document.createElement('p');
      shared.textContent = `Also used by ${details.otherOwnerCount} layout(s) belonging to `
        + 'other users you have shared this MOC with.';
      body.appendChild(shared);
    }

    if (details.truncated) {
      const truncated = document.createElement('p');
      truncated.textContent = 'This MOC is used by more layouts than could be listed.';
      body.appendChild(truncated);
    }
  });
}
