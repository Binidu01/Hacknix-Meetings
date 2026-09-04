<div align="center">

# Bini-Meetings

A modern, real-time video conferencing web app built with Next.js and mediasoup (WebRTC SFU) — high-quality multi-party video, screen sharing with audio, live chat, and a fully responsive UI.

![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-f1e05a?style=for-the-badge&logo=javascript&logoColor=white) ![CSS](https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white) ![mediasoup](https://img.shields.io/badge/mediasoup-WebRTC%20SFU-1B9E4B?style=for-the-badge)

[![Stars](https://img.shields.io/github/stars/Binidu01/Bini-Meetings?style=for-the-badge&logo=github)](https://github.com/Binidu01/Bini-Meetings/stargazers)
[![Forks](https://img.shields.io/github/forks/Binidu01/Bini-Meetings?style=for-the-badge&logo=github)](https://github.com/Binidu01/Bini-Meetings/network/members)
[![Issues](https://img.shields.io/github/issues/Binidu01/Bini-Meetings?style=for-the-badge&logo=github)](https://github.com/Binidu01/Bini-Meetings/issues)
[![License](https://img.shields.io/github/license/Binidu01/Bini-Meetings?style=for-the-badge)](https://github.com/Binidu01/Bini-Meetings/blob/main/LICENSE)

</div>

---

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Built With](#built-with)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Features

**Calling**
- Multi-party video calls over WebRTC, powered by a mediasoup SFU
- Clear audio with echo cancellation, noise suppression, and automatic gain control
- Screen sharing with optional system/tab audio
- Real-time in-call chat with unread-message notifications
- Live connection-quality indicator (ping/latency)

**Interface**
- Adaptive gallery grid that reflows its columns and rows to the number of participants (similar to Zoom or Google Meet), paging through with arrows once tiles would otherwise become too small
- WhatsApp-style 1:1 layout on mobile — the other participant fills the screen, with your own camera in a small corner box
- Dedicated screen-share layout with a scrollable participant strip
- Dark, glassmorphic interface with active-speaker highlighting and mic/camera status badges
- Meeting timer, participant count, and room-link sharing
- Auto-hiding controls on mobile for an unobstructed view

## Installation

### Prerequisites
- Node.js (v18 or higher recommended for mediasoup)
- npm or yarn
- A modern browser with WebRTC support (Chrome, Edge, Firefox, Safari)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Binidu01/Bini-Meetings.git

# Navigate to project directory
cd Bini-Meetings

# Install dependencies
npm install

# Start the signaling/SFU server (mediasoup + socket.io)
node server.js

# In a separate terminal, start the Next.js app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Usage

1. Open the app and create or enter a room.
2. On the join screen, enter your name and preview your camera and microphone. This preview is local only — you always join the meeting with camera off and microphone muted, and can enable them from inside the call.
3. Share the room link with others so they can join the same meeting.
4. Use the in-call controls to toggle your microphone or camera, share your screen, open chat, or leave the meeting.

## Built With
- **[Next.js](https://nextjs.org/)** — React framework and routing
- **[TypeScript](https://www.typescriptlang.org/)** — type-safe application code
- **[mediasoup](https://mediasoup.org/)** + **[socket.io](https://socket.io/)** — WebRTC SFU transport and real-time signaling
- **[Express](https://expressjs.com/)** — signaling server
- **[Tailwind CSS](https://tailwindcss.com/)** — styling
- **[lucide-react](https://lucide.dev/)** — icons

Language breakdown: TypeScript 72.9% · JavaScript 26.4% · CSS 0.6%

## Contributing

This project was built and is maintained solo, but contributions are welcome.

1. Fork the Project
2. Create your Feature Branch `git checkout -b feature/AmazingFeature`
3. Commit your Changes `git commit -m "Add some AmazingFeature"`
4. Push to the Branch `git push origin feature/AmazingFeature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

**Binidu01** - [@Binidu01](https://github.com/Binidu01)

Project Link: [https://github.com/Binidu01/Bini-Meetings](https://github.com/Binidu01/Bini-Meetings)

---

<div align="center">

**[Back to Top](#bini-meetings)**

Made by [Binidu01](https://github.com/Binidu01)

</div>
