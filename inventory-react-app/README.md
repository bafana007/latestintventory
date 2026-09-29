# Inventory React

React + Vite conversion of the original Inventory web application.

The existing interface, CSS, localStorage data model, Firebase authentication/database integration, barcode scanner, chat and Stripe checkout flow are preserved. React now provides the application shell while the original UI/view logic remains in `public/js` so the visual interface and behavior are not changed.

## Local development

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

For the full Express + Vite production-style server:

```bash
npm run build
npm start
```

Server: http://localhost:8080

## Production

```bash
npm install
npm run build
npm start
```

Render can use:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

The React/Vite project root is the repository root and contains `package.json`.
