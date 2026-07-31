import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

function run(command) {
  execSync(command, { stdio: 'inherit', shell: true })
}

run('npm run build')

if (!existsSync('android')) {
  run('npx cap add android')
}

run('npx cap sync android')

run('cd android && .\\gradlew.bat assembleDebug')

console.log('\nAPK generado en: android/app/build/outputs/apk/debug/app-debug.apk')
console.log('Si quieres abrir Android Studio: npm run cap:open')
