# 🚀 RENACER - Guía Rápida de Inicio

## ✅ Estado Actual del Proyecto

- ✅ **Frontend React** configurado y corriendo en `http://localhost:5174`
- ✅ **Base de datos Supabase** conectada y sincronizada
- ✅ **Logo RENACER** integrado en la app web
- ✅ **PWA configurada** (funciona como app en Android/iOS)
- ✅ **Capacitor instalado** para generar APK
- ✅ **Excel export** funcionando correctamente

---

## 📱 Opción 1: Instalar como PWA (Sin compilar)

### Android:
```
1. Abre http://localhost:5174/ en Chrome
2. Menú (⋮) → "Instalar aplicación"
3. ¡Listo!
```

### iOS:
```
1. Abre http://localhost:5174/ en Safari
2. Compartir → "Agregar a pantalla de inicio"
3. ¡Listo!
```

---

## 🔨 Opción 2: Generar APK con Capacitor (5 minutos)

### Pasos rápidos:
```bash
# Terminal 1: Construir la web
npm run build

# Terminal 2: Preparar Android
npm run cap:build-android

# Terminal 3: Abrir en Android Studio
npm run cap:open
```

### En Android Studio:
1. Espera a que cargue el proyecto
2. **Build** → **Build APK(s)**
3. Espera ~10 minutos
4. APK en: `android/app/release/app-release.apk`

---

## 🎯 Funciones Disponibles en la App

### 📋 Ordenes
- Ver todas las órdenes
- Ver detalles y estado
- Ver alertas de créditos por vencer

### ➕ Nueva Orden
- Crear clientes
- Crear órdenes con items
- Asignar llantas

### 👥 Clientes
- Listar todos los clientes
- Crear nuevos clientes
- Ver historial de órdenes (implementar)

### 📊 Reporte
- Filtrar por mes y año
- **Descargar Excel** (ya funciona ✅)
- Ver resumen de actividades

---

## 🔗 Conexiones

**Base de datos:** Supabase PostgreSQL  
**URL:** https://xialcpxahjfabsdywiws.supabase.co  
**Tablas:** clientes, ordenes, items, abonos  

---

## 🆘 Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| "No puedo instalar como PWA" | Abre en Chrome (no Firefox), ⋮ → Instalar |
| "El APK no se instala" | Activa "Instalar desde fuentes desconocidas" en tu teléfono |
| "Android Studio no abre" | Descárgalo desde android.com/studio |
| "El logo no se ve" | Recarga `http://localhost:5174` en el navegador |
| "Excel no descarga" | Verifica que haya órdenes en la base de datos |

---

## 📂 Estructura de Carpetas

```
Renacer/
├── src/               # Código React
│   ├── App.tsx       # Componente principal
│   ├── supabaseApi.ts # Funciones de BD
│   └── types.ts      # Tipos TypeScript
├── public/
│   ├── logo.svg      # Logo RENACER
│   ├── manifest.json # Config PWA
│   └── service-worker.js
├── mobile/           # Config para Expo/APK
│   └── app.json     # Configuración del APK
├── android/          # Generado por Capacitor (después de `cap add android`)
└── BUILD_APK.md     # Guía detallada de APK
```

---

## ⚡ Comandos Útiles

```bash
# Desarrollo
npm run dev          # Inicia servidor en http://localhost:5174

# Construcción
npm run build        # Compila para producción

# APK
npm run cap:prepare  # Prepara para Android
npm run cap:open     # Abre Android Studio

# Verificación
npm run typecheck    # Verifica tipos TypeScript
```

---

## 🎨 Personalización

Para cambiar colores, edita `src/App.tsx` - Los colores están hardcodeados en Tailwind:
- Azul marino: `#1a3a5e` (navy-500)
- Amarillo: `#ffd700` (primary-400)
- Gris: `#f4f5f7` (bg-light)

---

## 📝 Próximos Pasos

- [ ] Probar en teléfono real
- [ ] Crear datos de prueba en la BD
- [ ] Verificar que Excel descargue correctamente
- [ ] Configurar Google Play Store (después)

---

¡A disfrutar de RENACER! 🚀
