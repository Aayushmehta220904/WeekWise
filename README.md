# WeekWise

WeekWise is a vintage-style weekly timetable web app built with pure HTML, CSS, and JavaScript. It helps users plan their week in a clean notebook-inspired interface, organize study and break sessions, and keep track of the current day and time slot.

## Features

- Weekly timetable layout from **Monday to Sunday**
- Separate schedules for:
  - **Weekdays:** 8 PM to 12 AM
  - **Weekends:** 8 AM to 12 AM
- Color-coded slot types:
  - Study
  - Essential Break
  - Non-Essential Break
  - Empty
- Modal-based slot editing
- Optional title and notes for each time slot
- Current day and current hour highlighting
- Animated intro screen with typewriter effect
- Local storage support to preserve timetable data in the browser
- One-click **Clear All** option
- Fully responsive layout for desktop and smaller screens

## Tech Stack

- **HTML5**
- **CSS3**
- **JavaScript (Vanilla JS)**
- **Browser LocalStorage**

## Project Structure

```bash
WeekWise/
├── index.html
├── style.css
└── script.js
```

## How It Works

The app renders a timetable dynamically using JavaScript. Users can click any time slot to open a modal and assign:

- slot type
- title
- notes

All timetable entries are stored in the browser using `localStorage`, so data remains available even after refreshing the page.

## Getting Started

### Run Locally

1. Clone the repository:

```bash
git clone <your-repo-url>
```

2. Open the project folder.
3. Launch `index.html` in any modern web browser.

No installation or backend setup is required.

## Use Cases

WeekWise can be used for:

- study planning
- daily routine management
- weekend scheduling
- productivity tracking
- time blocking

## UI Highlights

- Notebook-paper visual design
- Vintage-themed color palette
- Responsive timetable cards
- Clean modal-based editing workflow
- Live “Now” indicator for the current slot

## Limitations

- Data is stored only in the local browser
- No user authentication or cloud sync
- No export or sharing feature
- Fixed timetable ranges for weekdays and weekends

## Future Improvements

- Add task completion checkboxes
- Add weekly statistics and productivity insights
- Export timetable as image or PDF
- Add dark mode
- Add Firebase or backend sync support
- Allow custom time ranges

## Why This Project

This project demonstrates:

- DOM manipulation in JavaScript
- localStorage-based persistence
- responsive UI design
- modal interactions
- clean front-end structuring without frameworks

## License

This project is open for learning and personal use.

## Author
**Aayush Mehta**
