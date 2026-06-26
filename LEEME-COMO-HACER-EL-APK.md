# 📱 Cómo convertir esto en una APK (sin instalar nada)

GitHub compila la app por vos en la nube y te devuelve el archivo `.apk` listo
para instalar en el celular. Seguí estos pasos una sola vez.

---

## 1) Crear el repositorio en GitHub

1. Entrá a **github.com** y creá una cuenta (gratis) si no tenés.
2. Arriba a la derecha: **+** → **New repository**.
3. Nombre: `mi-contabilidad` (o el que quieras). Dejalo **Public** o **Private**, da igual.
4. **NO** marques "Add a README". Tocá **Create repository**.

## 2) Subir los archivos de esta carpeta

En la página del repo recién creado:

1. Tocá el link **"uploading an existing file"** (o **Add file → Upload files**).
2. Arrastrá **TODO el contenido de esta carpeta**:
   - `package.json`
   - `capacitor.config.json`
   - `.gitignore`
   - la carpeta **`www`** (entera, con el `index.html` adentro)
   - la carpeta **`.github`** (entera, con `workflows/build-apk.yml` adentro)
3. Abajo, tocá **Commit changes**.

> ⚠️ Importante: respetá las carpetas. La app vive en `www/index.html` y la
> receta de compilación en `.github/workflows/build-apk.yml`. Si arrastrás las
> carpetas completas, GitHub mantiene la estructura solo.

## 3) Esperar a que compile

1. Andá a la pestaña **Actions** (arriba en el repo).
2. Vas a ver un proceso corriendo llamado **"Compilar APK"**. Tarda ~5 a 10 min.
3. Si no arrancó solo: entrá a **Actions → Compilar APK → Run workflow**.

## 4) Descargar el APK

1. Cuando el proceso termine con un ✅ verde, hacé clic en él.
2. Abajo de todo, en **Artifacts**, vas a ver **`MiContabilidad-APK`**.
3. Descargalo (viene en un `.zip`). Adentro está **`app-debug.apk`**.

## 5) Instalar en el celular

1. Pasá el `app-debug.apk` al teléfono (WhatsApp, mail, cable, lo que sea).
2. Abrilo. Android va a avisar *"instalar apps de orígenes desconocidos"* →
   dale permiso (es porque no viene de la Play Store, es normal).
3. ¡Listo! Ya tenés la app instalada.

---

## ¿Cómo actualizo la app más adelante?

Cada vez que cambiemos algo, reemplazás el `www/index.html` en el repo
(Add file → Upload files, o editás el archivo) y GitHub recompila solo.
Bajás el APK nuevo de Actions y lo reinstalás encima. Tus datos se mantienen.

## ¿Dónde quedan mis datos?

La app guarda todo solo, en una carpeta **MiContabilidad** del teléfono
(`datos.json`). Además tenés los botones **Descargar copia** (JSON),
**Exportar CSV** y **Google Sheets** (opcional). Aunque borres la caché o
reinstales, al abrir la app recupera los datos de esa carpeta.

---

### Datos técnicos (por si te los preguntan)
- Nombre app: **Mi Contabilidad** · ID: `com.bois.micontabilidad`
- Hecho con **Capacitor 6** + plugin **Filesystem**.
- El APK es de tipo *debug* (se instala directo, sin Play Store). Funciona igual
  que uno normal; solo no está firmado para publicar en la tienda.


## Minijuego por sacudida

Con **Sacudir el teléfono** activado en Configuración, una sacudida abre **Mosca 8 Bit**. El juego usa la inclinación del celular para mover la mosca y reproduce el sonido incluido cuando el matamoscas la aplasta. Los archivos están en `www/minijuego`.
