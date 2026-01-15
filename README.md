# Sistema Contable RPA (PHP) — Demo sin MySQL

Prototipo **100% en PHP + HTML/CSS/JS**, con navegación por módulos y datos guardados en archivos **JSON** (sin MySQL por ahora).

## Ejecutar (desde consola)
```bash
cd rpa_contable_php_moderno
php -S localhost:8000
```

Abrir en el navegador:
- http://localhost:8000/index.php

## Acceso (login)
- Usuario: `admin`
- Contraseña: `1234`

Los usuarios se administran en **Administración → Usuarios** (`data/users.json`).

## Logo de empresa
Se configura en **Administración → Empresa** (sube el logo). El logo se mostrará en el panel y en el login.

## Módulo Ventas (relevante)
- **Facturación**: entra primero a pantalla de búsqueda/listado → botón **Nuevo**.
  - Detalle mejorado: *quitar producto (deja la fila vacía)*, **quitar todo**, doble clic para limpiar campos.
  - Modal de ítems: buscar por **código/barra** o **descripción** (doble clic = seleccionar y cerrar).
  - Cliente: modal de búsqueda y modal de creación.
  - Si no hay **Punto de venta**, al facturar se abre pop‑out para seleccionar/crear PV.

## Persistencia (JSON)
Archivos en `/data/` (ej.: `invoices.json`, `credit_notes.json`, `guias.json`, `puntos_venta.json`, `autorizaciones.json`, ...).

> Nota: Este es un prototipo para pruebas de UI/flujo. Cuando indiques, se conecta a MySQL y se integra con autorización SRI real.
