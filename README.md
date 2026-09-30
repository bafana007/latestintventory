Inventory Management System — React Web App

I converted my Inventory Management System into a modern React + Vite web application, while preserving the existing interface and core functionality.

The application provides an organized platform for managing inventory and includes the existing system features with a React-based project structure.

Technologies Used

React

Vite

JavaScript

HTML5

CSS3

Firebase

Node.js

Express.js

REST API

Render

Project File Structure
inventory-react-app/
│
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── render.yaml
├── vercel.json
├── README.md
│
├── public/
│   ├── css/
│   │   └── style.css
│   ├── html/
│   ├── js/
│   ├── product-icons/
│   └── logo.svg
│
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   │
│   ├── components/
│   │   └── InventoryShell.jsx
│   │
│   ├── context/
│   │
│   ├── hooks/
│   │
│   ├── pages/
│   │
│   ├── services/
│   │   └── legacyLoader.js
│   │
│   ├── styles/
│   │   └── react-shell.css
│   │
│   └── utils/
│
└── server/
    └── index.js

Application Architecture
React + Vite
     │
     ├── Components
     ├── Pages
     ├── Context
     ├── Hooks
     ├── Services
     └── Utilities
             │
             ↓
       Express Server
             │
             └── API


The project is structured so that the React frontend can communicate with the Express backend while retaining the existing application interface and functionality.

Deployment

The application is configured for deployment on Render.

Build command:

npm install && npm run build


Start command:

npm start


Health check:

/api/health

Key Features

React-based frontend

Responsive inventory interface

Inventory management

User interface preserved from the original application

Firebase integration

Express backend

REST API structure

Production Vite build

Render deployment configuration

Organized component-based React architecture

This project represents another step in my development journey, focusing on React, full-stack development, API integration, deployment, and modern web application architecture.

#React #Vite #JavaScript #NodeJS #ExpressJS #Firebase #WebDevelopment #SoftwareDevelopment #InventoryManagement #FullStackDevelopment #Render
