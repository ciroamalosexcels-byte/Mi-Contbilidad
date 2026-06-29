# Mi Contabilidad (Bois)

> Siempre llamar al usuario por su nombre: **Ciro**.

App de finanzas personales de Ciro. PWA + APK Android con Capacitor.

## Arquitectura
- Todo en un solo archivo: `www/index.html` (HTML + CSS + JS, vanilla, sin framework)
- Storage: `localStorage` key `bois_conta_blank_v1`. En APK también backup a carpeta `MiContabilidad/` del dispositivo via Capacitor Filesystem.
- APK: GitHub Actions compila y publica al hacer push a `main`. Dev server: `npx serve www` en `localhost:8765`.

## Funciones clave
- Movimientos: `ingreso`, `gasto`, `deuda`, `medeben`
- Gastos fijos/recurrentes, metas, calendario, métricas, voz, notificaciones, sacudida, Google Sheets sync, export/import JSON
- Excedente del mes: lleva el sobrante al mes siguiente. Si el usuario lo edita, tiene `excedenteManual:true`.

## Temas: `light`, `dark`, `win`, `matrix`, `neo`, `blob`, `mosca` (8-bit)

## App ID
- `com.bois.micontabilidad` (Capacitor, `appName`: "Mi Contabilidad", `webDir`: `www`)

## Navegación
- Barra inferior fija: Lista, Calendario, Métricas, Configuración
- FABs (botones flotantes) quedan por encima de la barra

## Sacudida
- Activa desde Configuración; abre modal con acceso rápido a cargar movimiento o por voz
- Solo funciona en APK instalada (no en PWA)

## Notificaciones
- Plugin: `@capacitor/local-notifications` (Capacitor 6)
- Se programan 3 días antes y el mismo día para deudas, cuotas, gastos fijos y cobros
- También aviso de resumen mensual si está activado
- Ícono: `www/assets/ic_notification.png` (mosca pixel art, negro sobre blanco)
  - El workflow lo convierte a blanco sobre transparente con ImageMagick y lo copia a `android/app/src/main/res/drawable/`
  - Configurado en `capacitor.config.json` → `LocalNotifications.smallIcon: "ic_notification"`

## Sonidos
- Archivos en `www/assets/sounds/`: `movement-added.mp3`, `action-open.mp3`, `navigation.mp3`
- No requieren plugins, reproducción nativa del browser

## Google Sheets
- Script en `GOOGLE-SHEETS-APPS-SCRIPT.gs`, se despliega como web app con URL terminada en `/exec`
- Hojas: `Movimientos` y `Config`
- La app tiene botón "Copiar código GS" que copia el script al portapapeles
- NO usar URL `/dev`, siempre `/exec`; crear nueva versión al modificar el script

## Archivos adicionales
- `GOOGLE-SHEETS-APPS-SCRIPT.gs` — script Apps Script para sync con Sheets
- `www/assets/` — recursos estáticos (íconos, sonidos, etc.)
- `www/minijuego/` — minijuego incluido en la app

## Convenciones
- `save()` → persiste state a localStorage
- `render()` + `buildMonths()` → redibujan la UI
- `money(n)` → `$1.234` (es-AR)
- `monthKey(fecha)` → `'YYYY-MM'`, `todayYM()` → mes actual

## Fixes importantes ya hechos
- `overflow-x:clip` en `body.mosca` (no `hidden`, rompería `position:fixed`)
- `overflow:clip` en `.app-bottom-nav` MOSCA (evita BFC que interfería con `will-change:transform`)
- `user-scalable=no` en viewport meta (zoom accidental en mobile)
- `zeroExcedentesThroughJune2026()` ya no pisa excedentes con `excedenteManual:true`
- Resumen anual: gastos en rojo `-$X`, ingresos en verde `+$X`
- Micrófono: `openVoiceAndListen` es async y llama `requestMicAccess` sin setTimeout (el setTimeout rompía el contexto de gesto de usuario en Android, bloqueando el diálogo de permiso)
