# Truth or Dare — Secure Multiplayer Edition

Features:
- Email/password accounts via Firebase Authentication
- Private 6-character rooms
- Host controls + player join/leave presence
- 107 Truth + 108 Dare prompts
- Local pass-and-play mode
- Online live Truth/Dare challenge mode
- WebRTC camera + microphone for the active challenger
- Consent gate before camera/mic access
- Background music + event sound controls
- Haptic feedback where supported
- Admin dashboard (custom prompts, timers, music URL, room controls)
- Realtime Database rules designed around authenticated room members
- Admin role is a Firebase custom claim, not a client-side password

## Firebase setup
1. Enable Email/Password in Firebase Authentication.
2. Create Realtime Database and deploy `database.rules.json`.
3. Set `firebase-config.js`.
4. Deploy Hosting.
5. Set `ADMIN_EMAIL` for the Functions deployment (see `.env.example`).
6. Deploy Functions from `functions/`.
7. Use the Admin verification button once with that exact account; then refresh/sign in again.

## Security
Do not put passwords, admin passwords, or service-account keys in the frontend. Firebase Auth handles credentials; database rules use authenticated UIDs/custom claims. Firebase recommends authenticated, narrow rules rather than public read/write rules.

Camera/microphone are never opened automatically without browser permission. HTTPS is required for `getUserMedia()`.

## Admin
The admin screen is available only to users whose Firebase Auth token has the `admin` custom claim. The claim is assigned server-side by the Cloud Function, so changing a frontend email string cannot grant admin access.

## Media
For music, provide an HTTPS URL to an audio file you are authorized to use. The project does not bundle copyrighted commercial tracks.


## Admin setup for this Firebase project
The admin UID is configured server-side in `database.rules.json` and in the client only to show the admin button. Database authorization is enforced by Realtime Database Rules. Do not expose passwords or service-account keys.
