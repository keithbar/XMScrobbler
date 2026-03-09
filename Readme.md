# XM Scrobbler

A web app that automatically scrobbles your SiriusXM listening activity to [Last.fm](https://www.last.fm). Select a station, set a timeout, and XM Scrobbler handles the rest — tracking what you listen to and submitting it to your Last.fm profile in real time.

---

## Features

- **Last.fm OAuth authentication** — secure login via Last.fm's official API
- **Live station list** — pulls available SiriusXM channels directly from the [xmplaylist.com](https://xmplaylist.com) API
- **Automatic scrobbling** — polls for new tracks on a configurable interval and submits them to Last.fm
- **Session persistence** — scrobbling state is preserved server-side, so closing or refreshing the browser doesn't interrupt your session
- **Auto-stop timer** — set a timeout of 1, 2, 4, 8, or 12 hours after which scrobbling stops automatically
- **Efficient polling** — a single API call fetches track data for all active stations simultaneously, keeping external API usage minimal

---

## Tech Stack

- **Backend** — Node.js, Express
- **Session management** — express-session
- **External APIs** — Last.fm API, xmplaylist.com API
- **Frontend** — Vanilla JS, HTML, CSS

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [Last.fm API account](https://www.last.fm/api/account/create) (free)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/keithbar/XMScrobbler.git
   cd xm-scrobbler
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root (see [Environment Variables](#environment-variables) below):
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   node server.js
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Create a `.env` file in the project root with the following values:

| Variable | Description |
|---|---|
| `LASTFM_API_KEY` | Your Last.fm API key |
| `LASTFM_API_SECRET` | Your Last.fm API secret |
| `SESSION_SECRET` | A long, random string used to sign session cookies |
| `BASE_URL` | URL of the app. If running locally, can be left blank |

A `.env.example` file is included in the repository as a reference.

---

## Project Structure

```
root/
├── server.js               # Express app, route handlers, startup logic
├── public/
│   ├── index.html          # Frontend UI
│   ├── app.js              # Frontend JavaScript
│   └── style.css           # Styles
├── services/
│   ├── state.js            # Shared activeChannels map
│   ├── lastfmService.js    # Last.fm API calls (auth, scrobbling)
│   ├── pollingService.js   # Background polling loop
│   └── xmplaylistService.js# xmplaylist.com API calls
├── utils/
│   ├── logger.js           # Debug logging utility
│   ├── signature.js        # Last.fm API signature generation
│   └── sleep.js            # Promise-based sleep utility
└── tests/
    └── simulateUsers.js    # Configurable stress test script
```

---

## Deployment

This app can be run locally or deployed online using a service like [Render](https://render.com).

---

## Acknowledgements

Track data provided by [xmplaylist.com](https://xmplaylist.com). Scrobbling powered by the [Last.fm API](https://www.last.fm/api).