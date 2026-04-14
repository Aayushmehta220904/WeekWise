# WeekWise

**WeekWise** is a modern weekly planning web app built with pure HTML, CSS, and JavaScript. It helps users organize their full week in a clean glass effect interface, manage alternate day schedules, categorize work using tags, and save multiple week modes for different routines.

## Features

- Full weekly timetable from **Monday to Sunday**
- Time slots for the complete day:
  - **12:00 AM to 11:00 PM**
  - **1-hour slots**
- Separate day wise schedule management
- Support for **multiple variants** of the same day  
  Example: **Normal Tuesday, Holiday Tuesday, Exam Tuesday**
- Support for **Week Modes**
  - Save the current weekly setup
  - Create empty week modes
  - Switch between saved modes
- **Tag-based planning system**
  - Create custom tags
  - Reuse saved tag colors automatically
  - Edit tags globally
  - Delete tags globally
- Multi tag support per slot
- Slot details include:
  - **title**
  - **notes**
  - **tags**
  - **lock status**
- **Locked slots** to prevent bulk overwrite
- Bulk apply changes to:
  - only current slot
  - all weekdays at the same hour
  - all weekends at the same hour
  - all days at the same hour
- **Copy day schedule** to another day
- **Weekly analytics dashboard**
  - filled slots
  - empty slots
  - locked slots
  - most used tag
  - busiest day
  - tag wise breakdown
  - day wise breakdown
- Search bar for timetable entries
- Tag based filters
- Current day and current hour highlighting
- Animated intro screen with typewriter effect
- In app modals and drawers for editing and management
- Local storage support to preserve timetable data in the browser
- **Clear All** option with confirmation popup
- Theme switch:
  - **Light theme:** orange white glass
  - **Dark theme:** orange black glass
- Custom logo and favicon support
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
├── script.js
└── assets/
    ├── logo.png
    └── favicon.png
    └── icon-192.png
    └── icon-512.png
```

## How It Works

The app renders the weekly timetable dynamically using JavaScript. Each day contains **24 hourly slots**. Users can click any slot and manage:

- **title**
- **notes**
- **tags**
- **locked state**

Users can also create alternate variants of days and save complete weekly arrangements as reusable **Week Modes**.

All data is stored in the browser using **localStorage**, so schedules remain available even after refreshing the page.

The project also includes a **web app manifest** so that browsers like Chrome can install WeekWise as an app with dedicated icons instead of using a generated default shortcut icon.

## Use Cases

**WeekWise** can be used for:

- study planning
- class scheduling
- exam week planning
- holiday routine management
- productivity planning
- time blocking
- alternate weekly schedule management

## UI Highlights

- Glassmorphism inspired modern interface
- Light and dark theme switch
- Responsive timetable cards
- Drawer and modal based editing workflow
- Weekly analytics section
- Search and filter system
- Live **“Now”** indicator for the current slot
- Logo supported branded UI

## Current Capabilities

- Save multiple week modes
- Create empty planning modes
- Manage alternate day variants
- Edit and delete tags globally
- Copy schedules between days
- Lock important slots
- Analyze weekly schedule distribution
- Preserve all data using browser storage
- Custom logo, favicon, and installable app icons support

## Limitations

- Data is stored only in the local browser
- No user authentication or cloud sync
- No export or sharing feature
- No backend database
- Data may not transfer across devices or browsers automatically

## Future Improvements

- Export timetable as image or PDF
- Cloud sync support
- User login and multi device access
- Drag and drop slot editing
- Calendar/date-based special schedule overrides
- Notifications or reminders
- More advanced analytics
- Import/export backup JSON

## Why This Project

This project demonstrates:

- DOM manipulation in JavaScript
- localStorage based persistence
- dynamic timetable rendering
- modal and drawer interactions
- reusable scheduling logic
- tag based filtering
- analytics UI generation
- responsive frontend design without frameworks

## License

This project is open for learning and personal use.

## Author

**Aayush Mehta**
