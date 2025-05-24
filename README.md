# RideMapper - Route Management PWA

A Progressive Web App for real-time route management and participant tracking. Allows route managers to create routes and track participants' live locations, with messaging capabilities.

## Features

- **Two User Personas:**
  - **Route Manager**: Create routes, monitor participants, send messages
  - **Participant**: Join sessions, share live location

- **Route Management:**
  - Interactive route creation using Google Maps
  - Add start, end, and waypoint markers
  - Visual route display with directions

- **Live Location Tracking:**
  - Real-time participant location updates
  - Visual markers on map for all participants
  - Location status indicators

- **Messaging System:**
  - Managers can send messages to individual participants
  - Click on participant markers to message

- **Session Management:**
  - PIN-based session access for participants
  - Password-protected manager access
  - Session persistence

- **PWA Features:**
  - Install on mobile devices
  - Offline capability (with service worker)
  - Responsive design

## Tech Stack

- **Frontend**: Vue 3 with TypeScript
- **State Management**: Pinia
- **Routing**: Vue Router
- **Maps**: Google Maps JavaScript API
- **PWA**: Vite PWA Plugin
- **Styling**: Scoped CSS with modern gradients

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Google Maps API Key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ridemapper
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

4. Update the Google Maps API key in `src/views/MapView.vue`:
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with `${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Manager Access

1. Go to the home page
2. Click "Login as Manager"
3. Use password: `RideManager2024`
4. Create a new session
5. Share the PIN with participants
6. Click on the map to create a route
7. Monitor participants and send messages

### Participant Access

1. Go to the home page
2. Click "Join Session"
3. Enter the 6-digit PIN from the manager
4. Enter your name
5. Allow location access when prompted
6. Your location will be shared with the manager

## Important Notes

- **Google Maps API**: You need to enable the Maps JavaScript API and Places API in your Google Cloud Console
- **HTTPS Required**: Location services require HTTPS in production
- **Manager Password**: The default password is hardcoded for demo purposes. In production, use proper authentication
- **Real-time Updates**: Currently uses local state. For production, implement WebSocket or similar for real-time sync

## PWA Installation

### Mobile (Android/iOS)

1. Open the app in Chrome/Safari
2. You'll see an "Install" prompt or use the browser menu
3. Add to home screen
4. The app will function like a native app

### Desktop (Chrome/Edge)

1. Look for the install icon in the address bar
2. Click to install
3. The app will open in its own window

## Security Considerations

- Implement proper authentication for managers
- Use HTTPS for all communications
- Validate session PINs on the backend
- Implement rate limiting for PIN attempts
- Consider privacy implications of location tracking

## Future Enhancements

- Backend API for data persistence
- Real-time sync with WebSocket/Socket.io
- Route history and analytics
- Voice/video calling between manager and participants
- Offline route caching
- Multi-language support
- Export routes to GPX/KML formats

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
