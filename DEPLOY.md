# Deploy thr4ce

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main**, folder **/(root)**, then click **Save**.
5. The app will be available at:

   https://h333ndrik.github.io/thr4ce/

GitHub Pages serves the site over HTTPS, which is required for service workers outside localhost.

## Install

- **iOS / iPadOS:** Open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** Open the site in Chrome, then choose **Install app**.
- **Desktop:** Use the install icon in the browser address bar.

## Updates

After a push, reload the app and close/reopen it once. The service worker calls `skipWaiting()` and `clients.claim()` so the new version takes control immediately.

> Service workers work only over HTTPS or localhost. GitHub Pages supplies HTTPS automatically.
