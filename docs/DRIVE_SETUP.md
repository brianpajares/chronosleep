# DRIVE_SETUP — Google Drive
Objetivo: la app lee `/Apps/chronosleep/` con service account, verifica checksum, cachea 24 h y conserva last-known-good.

## 1. Crear service account
1. En Google Cloud, crear proyecto dedicado o usar uno existente controlado.
2. Habilitar Google Drive API.
3. Crear service account sin roles amplios de proyecto.
4. Crear credencial/clave de servicio solo si la política de la organización lo permite; preferir Workload Identity donde esté disponible.
5. Guardar email y clave en el secret manager de Vercel/Netlify, nunca en repo.

## 2. Crear y compartir carpeta
1. En Drive crear `/Apps/chronosleep/`.
2. Compartir **solo esa carpeta** con `GOOGLE_SERVICE_ACCOUNT_EMAIL` como Editor para `drive:sync`; si producción solo lee, evaluar cuenta separada Read-only.
3. Copiar el ID de carpeta a `GOOGLE_DRIVE_FOLDER_ID`.
4. La carpeta debe reflejar exactamente `drive/base`, `drive/model`, `drive/templates`, `drive/docs`.

## 3. Variables
Usar exactamente: `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. Ver `.env.example`.

## 4. `npm run drive:sync`
Implementar `scripts/drive-sync.ts`:
- recorre `drive/` recursivamente;
- crea subcarpetas si faltan;
- sube/actualiza por nombre dentro de la carpeta correcta;
- imprime SHA-256 local y Drive;
- falla si no puede verificar;
- nunca borra archivos remotos por defecto.

## 5. Lectura en runtime
- Fuente de checksums: `spec/drive_manifest.json`.
- Resolver ruta bajo `GOOGLE_DRIVE_FOLDER_ID`.
- Descargar solo si cache expiró.
- Verificar SHA-256 antes de promocionar el archivo a cache válido.
- TTL: 24 h.
- Si Drive falla/checksum no coincide: conservar último cache válido y emitir Sentry `drive_degraded` sin contenido de archivo sensible.
- No hacer una llamada Drive por request de usuario.

## 6. Verificación
`npm run drive:verify` debe comparar los 7 artefactos del manifest y fallar si falta alguno o cambia checksum. El paquete v4 ya fue auditado y los checksums del input coincidieron.
