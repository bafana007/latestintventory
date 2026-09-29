const scripts = [
  '/js/firebase.js?v=5',
  '/js/templates.js?v=3',
  '/js/store.js?v=3',
  '/js/ui.js?v=3',
  '/js/views/landing.js?v=3',
  '/js/views/auth.js?v=3',
  '/js/views/admin.js?v=3',
  '/js/views/employee.js?v=3',
  '/js/views/portal.js?v=3',
  '/js/chat.js?v=3',
  '/js/app.js?v=5',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-inventory-script="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.inventoryScript = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export async function loadInventoryRuntime() {
  for (const src of scripts) await loadScript(src);
}
