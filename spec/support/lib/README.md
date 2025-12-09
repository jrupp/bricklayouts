# Fast-Check Library Updates

This directory contains local copies of the fast-check and pure-rand libraries downloaded from jsDelivr CDN.

## Files

- `fast-check.mjs` - Property-based testing library (v3.15.0)
- `pure-rand.mjs` - Random number generator dependency (v6.0.4)
- `update-libraries.sh` - Script to download and update the libraries

## Why Local Copies?

These libraries are stored locally instead of importing from CDN because:
1. The jsDelivr ESM bundle includes external dependencies that need to be resolved
2. Sandbox environments may block CDN access
3. Local copies ensure tests run reliably without network dependencies

## Updating the Libraries

To update to newer versions of the libraries, run:

```bash
cd spec/support/lib
./update-libraries.sh
```

Or specify custom versions:

```bash
FAST_CHECK_VERSION=3.16.0 PURE_RAND_VERSION=6.1.0 ./update-libraries.sh
```

The script will:
1. Download the specified versions from jsDelivr CDN
2. Automatically update the import path in fast-check.mjs to use the local pure-rand.mjs
3. Verify the changes were applied correctly

After updating, run the test suite to verify everything works:

```bash
cd ../../..  # Navigate to repository root
SE_MANAGER_PATH=$(pwd)/.github/selenium-manager-offline.sh npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.agent.mjs
```

**Note**: Do NOT use `npm test` as it starts an interactive server that will hang. Use the command above for the Copilot Agent sandbox environment.

## Version Compatibility

- fast-check v3.15.0 requires pure-rand v6.0.4
- Always check the fast-check release notes for compatible pure-rand versions
- The update script defaults to tested, compatible versions
