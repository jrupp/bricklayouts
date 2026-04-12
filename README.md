# BrickLayouts

A webapp to design L-Gauge scale train layouts for LEGO® trains or other compatible brick brands.

Try it out: <https://app.bricklayouts.com/>

## For Developers

### Setup your Environment

* Install [Node.js](https://nodejs.org/en/download/)
* Run `npm install`

### Running Locally

```shell
npm start
```

Open your browser to the address shown on your screen

### Running test suite

#### Interactive (browser)

```shell
npm test
```

Open your browser to the address shown on your screen.

#### Headless (CI / automated)

```shell
CI=true npx jasmine-browser-runner runSpecs --config=spec/support/jasmine-browser.ci.mjs
```

#### WSL2 setup

WSL2 doesn't include Chrome by default. To run headless tests you need to install it:

```shell
./.github/setup-chrome-simple.sh
```

This installs Chrome and lets `selenium-manager` automatically download a matching ChromeDriver. After setup, verify with `google-chrome --version`.

If Chrome won't start, you may need additional dependencies:

```shell
sudo apt-get install -y libgbm1 libasound2
```

## Disclaimer

LEGO® is a trademark of The LEGO Group of companies which does not sponsor, authorize or endorse this site.

## Credits

* This project is using the [MIT license](LICENSE.txt) and is © Copyright 2025 Justin Rupp, unless otherwise noted here
* Some icons are from Flaticon.com
* Some component images originally derived from rendered LDraw parts from The LDraw Parts Library
* The dark mode toggle is Copyright (c) 2025 by Jhey (<https://codepen.io/jh3y/pen/LYgjpYZ>)
* Thank you to [moonline](https://github.com/moonline/Webapp.TrackDesigner) for the inspiration and ideas
