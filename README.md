# Proyectos

App web estática lista para desplegar en Netlify.

## Archivos

- `index.html`: estructura principal
- `styles.css`: estilos
- `app.js`: lógica de la app y Firebase
- `netlify.toml`: configuración mínima de Netlify

## Cómo probar localmente

No abras `index.html` con doble clic ni con ruta `file://`.

Como `app.js` se carga con:

```html
<script type="module" src="app.js"></script>
```

el navegador necesita servir los archivos por `http://localhost`, no por `file://`.

## Opción más simple: Live Server en VS Code

1. Instala la extensión `Live Server`.
2. Haz clic derecho sobre `index.html`.
3. Elige `Open with Live Server`.
4. Se abrirá algo como:

```txt
http://127.0.0.1:5500/index.html
```

## Opción simple con Python

Si tienes Python instalado:

```bash
cd /Users/joelrojas/Documents/cid-gallup-projects
python3 -m http.server 5500
```

Luego abre:

```txt
http://localhost:5500/index.html
```

## Nota

Si la página abre pero no carga datos, revisa la consola del navegador. En ese caso normalmente el problema ya no sería `file://`, sino Firebase o permisos de Firestore.
