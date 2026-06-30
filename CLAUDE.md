# Mi Contabilidad (Bois)

> Llamar al usuario por su nombre: **Ciro**. Cada tanto, usar **Cirito**.

App de finanzas personales de Ciro. PWA + APK Android con Capacitor.

## Arquitectura
- Todo en un solo archivo: `www/index.html` (HTML + CSS + JS, vanilla, sin framework)
- Storage: `localStorage` key `bois_conta_blank_v1`. En APK también backup a carpeta `MiContabilidad/` del dispositivo via Capacitor Filesystem.
- APK: GitHub Actions compila y publica al hacer push a `main`. Dev server: `npx serve www` en `localhost:8765`.

## Funciones clave
- Movimientos: `ingreso`, `gasto`, `deuda`, `medeben`
- Gastos fijos/recurrentes, metas, calendario, métricas, voz, notificaciones, sacudida, Google Sheets sync, export/import JSON
- Excedente del mes: lleva el sobrante al mes siguiente. Si el usuario lo edita, tiene `excedenteManual:true`.
- Búsqueda en tiempo real sobre la lista (filtra por desc/cat)
- Export PDF del mes (`window.print()` con `@media print` dedicado)
- Gráficos extendidos: Métricas muestra 6 meses en vez de 3 cuando está activado
- Recordatorios inteligentes: notificación si pasan 3+ días sin movimientos; aviso de fin de mes si hay gastos fijos sin registrar (IDs 9001/9002)
- Onboarding: modal de 4 slides al primer uso (`localStorage` key `bois_onboarded_v1`); slide 4 permite agregar/quitar categorías con chips interactivos
- Cada función extra tiene toggle on/off en **Configuración → Funciones extras** (`state.features.{graficosExt,busqueda,pdf,notifInteligentes}`)

## Temas: `light`, `dark`, `win`, `matrix`, `neo`, `blob`, `mosca` (8-bit)

## App ID
- `com.bois.micontabilidad` (Capacitor, `appName`: "Mi Contabilidad", `webDir`: `www`)

## Navegación
- Barra inferior fija: Lista, Calendario, Métricas, Configuración
- FABs (botones flotantes) quedan por encima de la barra

## Sacudida / Giroscopio
- En Configuración el botón se llama "Activar giroscopio" (antes "sacudida"), sin texto explicativo
- Abre modal con acceso rápido a cargar movimiento o por voz
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

## Micrófono / Voz
- Modal se llama "Carga por voz"; campo de texto grande sin placeholder; botones Hablar e Interpretar del mismo tamaño; sin botón Cerrar (solo la X)
- `openVoiceAndListen` es async, llama `requestMicAccess` sin setTimeout (el setTimeout rompía el contexto de gesto de usuario en Android)
- En Configuración hay botón "Permiso de micrófono" → llama `requestMicPermission()` que dispara `getUserMedia` y como fallback inicia `SpeechRecognition` para forzar el diálogo nativo de Android
- `RECORD_AUDIO` se agrega al `AndroidManifest.xml` en el workflow (sin esto Android no muestra el diálogo de permiso)

## UX general
- Todas las modales se cierran al tocar fuera (un solo `querySelectorAll('.ov')` con `closeOverlay`)
- `-webkit-text-size-adjust:100%` en body para evitar zoom automático en mobile (afectaba a todos los temas excepto blob)
- Neo: colores claros (`#c1efb4`, `#ffdad6`, `#bee9ff`, `#ffdb6e`) en dots, KPI vals y "Falta pagar"
- Sin emojis en ninguna parte del código ni la UI — usar SVGs o texto plano

## Fixes importantes ya hechos
- `overflow-x:clip` en `body.mosca` (no `hidden`, rompería `position:fixed`)
- `overflow:clip` en `.app-bottom-nav` MOSCA (evita BFC que interfería con `will-change:transform`)
- `user-scalable=no` en viewport meta (zoom accidental en mobile)
- `zeroExcedentesThroughJune2026()` ya no pisa excedentes con `excedenteManual:true`
- Resumen anual: gastos en rojo `-$X`, ingresos en verde `+$X`
