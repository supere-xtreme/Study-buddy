# StudyBuddy – AI study assistant (PC + Android)

## Run on PC
1. Install Node.js 18+ (nodejs.org).
2. Copy `.env.example` to `.env` and put your OpenAI API key in it.
3. Run `npm start`, open http://localhost:3000

## Use on Android
- Same Wi-Fi: open `http://<your-PC-IP>:3000` in Chrome on the phone.
- Anywhere (recommended): deploy this folder to a cloud host (Render, Railway, Fly.io),
  set env var OPENAI_API_KEY, open the https URL in Chrome > menu > "Install app".

Run tests: `npm test`
