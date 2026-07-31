# 📱 Guía para Crear APK de Renacer

## 🎯 Opción Recomendada: PWA (Para Comenzar)

Tu aplicación ya funciona como **Progressive Web App (PWA)** - no necesitas compilar nada:

### En Android (Chrome/Firefox):
```
1. Abre http://localhost:5174/
2. Toca ⋮ (menú)
3. Selecciona "Instalar aplicación"
4. ¡Listo! La app estará en tu pantalla de inicio
```

### En iOS (Safari):
```
1. Abre http://localhost:5174/ en Safari
2. Toca el botón compartir (cuadro con flecha)
3. Selecciona "Agregar a pantalla de inicio"
```

---

## 🔨 Opción 2: APK Nativo con Capacitor (Recomendado para Producción)

Ya está instalado Capacitor. Sigue estos pasos:

### 1. Construir la app web:
```bash
npm run build
```
Esto genera la carpeta `dist/` con el código optimizado.

### 2. Agregar Android (primera vez solamente):
```bash
npx cap add android
```

### 3. Sincronizar cambios:
```bash
npx cap sync
```

### 4. Abrir en Android Studio:
```bash
npx cap open android
```

### 5. En Android Studio:
1. Espera a que se cargue el proyecto
2. Click en **Build** (barra superior)
3. Selecciona **Build Bundle(s) / APK(s)** → **Build APK(s)**
4. Espera a que termine (~5-10 minutos)

### 6. Encontrar el APK:
```
android/app/release/app-release.apk
```

### 7. Instalar en tu teléfono:
- Opción A: Conecta por USB con "Depuración de USB" habilitada y arrastra el APK
- Opción B: Abre el APK directamente en tu teléfono (descárgalo por correo, WhatsApp, etc.)

---

## ☁️ Opción 3: EAS (Expo Application Services - En la Nube)

Para generar APK sin instalar Android Studio:

### 1. Instalar EAS CLI:
```bash
npm install -g eas-cli
```

### 2. Autenticarse:
```bash
eas login
```

### 3. Generar APK en la nube:
```bash
cd mobile
eas build --platform android --profile preview
```

El APK se genera automáticamente y se descarga en tu navegador.

---

## 📋 Requisitos por Opción:

### PWA (Opción 1):
- ✅ Solo un navegador (Chrome, Firefox, Safari)
- ✅ Funciona sin conexión (después de primer acceso)
- ⚠️ NO es un "verdadero" APK

### Capacitor (Opción 2):
- **Android Studio** (2+ GB)
- **Java SDK 11+**
- **Android SDK**
- Espacio: ~10 GB

### EAS (Opción 3):
- Cuenta en **expo.dev** (gratis)
- Internet (la compilación es en la nube)
- ✅ Más fácil, sin instalar herramientas locales

---

## 🚀 Pasos Rápidos (Capacitor + Android Studio):

```bash
# 1. Construir web
npm run build

# 2. Preparar Android
npx cap add android
npx cap sync

# 3. Abrir en Android Studio
npx cap open android

# 4. En Android Studio: Build → Build APK(s)
# 5. Resultado: android/app/release/app-release.apk
```

---

## 🎨 Configuración de Logo:

✅ El logo está en `public/logo.svg` (SVG escalable)  
✅ Configurado en `index.html` como favicon e icono de PWA  
✅ Configurado en `mobile/app.json` para iOS y Android  
✅ El manifest.json lo incluye automáticamente  

---

## 🆘 Si Algo Falla:

- **"Android Studio no se abre"** → Instálalo desde android.com/studio
- **"No hay Java"** → Descarga Java 11 desde oracle.com
- **"Capacitor no funciona"** → Ejecuta `npm install` nuevamente
- **"APK no se instala"** → Activa "Instalar desde fuentes desconocidas" en tu teléfono

---

## 💡 Mi Recomendación:

1. **Para Testing rápido:** Usa PWA (Opción 1) - Instálalo en 30 segundos
2. **Para Producción:** Usa Capacitor (Opción 2) - Verdadero APK
3. **Si no tienes Android Studio:** Usa EAS (Opción 3) - Todo en la nube

¡Mucho éxito! 🎉

