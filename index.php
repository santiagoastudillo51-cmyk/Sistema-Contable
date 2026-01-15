<?php
require __DIR__ . "/includes/bootstrap.php";

$r = route();

// Cargar layout/UI solo para pantallas (no para APIs).
// Evita que las rutas api/* devuelvan HTML y rompan fetch(JSON).
if (!str_starts_with($r, 'api/')) {
  require __DIR__ . "/includes/ui.php";
}

// AUTH_GUARD
if (!str_starts_with($r, "auth/")) {
  $u = $_SESSION["user"] ?? null;
  if (!$u) {
    // Para llamadas AJAX a APIs, no redirigir a HTML (rompe fetch/json)
    if (str_starts_with($r, 'api/')) {
      header('Content-Type: application/json; charset=utf-8');
      http_response_code(401);
      echo json_encode(['ok'=>false,'error'=>'Sesión no válida. Inicie sesión nuevamente.']);
      exit;
    }
    header("Location: index.php?route=auth/login");
    exit;
  }
}


$map = [
  "auth/login" => __DIR__ . "/pages/auth/login.php",
  "auth/logout" => __DIR__ . "/pages/auth/logout.php",
  "auth/forgot" => __DIR__ . "/pages/auth/forgot.php",

  // API (JSON)
  "api/clientes_save" => __DIR__ . "/pages/api/clientes_save.php",
  "api/ai_summary" => __DIR__ . "/pages/api/ai_summary.php",
  "api/chat" => __DIR__ . "/pages/api/chat.php",

  // Contabilidad API
  "api/contabilidad_asiento_delete" => __DIR__ . "/pages/api/contabilidad_asiento_delete.php",
  "api/contabilidad_asiento_get" => __DIR__ . "/pages/api/contabilidad_asiento_get.php",
  "api/contabilidad_asiento_pdf" => __DIR__ . "/pages/api/contabilidad_asiento_pdf.php",
  "api/contabilidad_asiento_save" => __DIR__ . "/pages/api/contabilidad_asiento_save.php",
  "api/contabilidad_asiento_update" => __DIR__ . "/pages/api/contabilidad_asiento_update.php",
  "api/contabilidad_verificar_pdf" => __DIR__ . "/pages/api/contabilidad_verificar_pdf.php",
  "api/contabilidad_verificar_excel" => __DIR__ . "/pages/api/contabilidad_verificar_excel.php",
  "api/contabilidad_diario_export_pdf" => __DIR__ . "/pages/api/contabilidad_diario_export_pdf.php",
  "api/contabilidad_diario_export_excel" => __DIR__ . "/pages/api/contabilidad_diario_export_excel.php",

  "dashboard" => __DIR__ . "/pages/dashboard.php",
  "dashboard/reportes" => __DIR__ . "/pages/reportes.php",

  "ia" => __DIR__ . "/pages/ia.php",
  "ia/auditoria" => __DIR__ . "/pages/ia_auditoria.php",

  // Ventas (cada opción entra primero a pantalla de búsqueda/listado)
  "ventas/home" => __DIR__ . "/pages/ventas/home.php",
  "ventas/reportes" => __DIR__ . "/pages/ventas/reportes.php",
  "ventas/ia" => __DIR__ . "/pages/ventas/ia.php",

  "ventas/factura" => __DIR__ . "/pages/ventas/factura_buscar.php",
  "ventas/factura/nuevo" => __DIR__ . "/pages/ventas/factura_form.php",

  "ventas/notas_credito" => __DIR__ . "/pages/ventas/notas_credito_buscar.php",
  "ventas/notas_credito/nuevo" => __DIR__ . "/pages/ventas/notas_credito_form.php",

  "ventas/guias" => __DIR__ . "/pages/ventas/guias_buscar.php",
  "ventas/guias/nuevo" => __DIR__ . "/pages/ventas/guias_form.php",

  "ventas/retenciones" => __DIR__ . "/pages/ventas/retenciones_buscar.php",
  "ventas/retenciones/nuevo" => __DIR__ . "/pages/ventas/retenciones_form.php",

  "ventas/recurrente" => __DIR__ . "/pages/ventas/placeholder.php",
  "ventas/cuadres" => __DIR__ . "/pages/ventas/placeholder.php",
  "ventas/ordenes" => __DIR__ . "/pages/ventas/placeholder.php",
  "ventas/promociones" => __DIR__ . "/pages/ventas/placeholder.php",
  "ventas/proyectos" => __DIR__ . "/pages/ventas/placeholder.php",
  "ventas/parametros" => __DIR__ . "/pages/ventas/parametros.php",

  // Contabilidad
  "contabilidad/home" => __DIR__ . "/pages/contabilidad/home.php",
  "contabilidad/reportes" => __DIR__ . "/pages/contabilidad/reportes.php",
  "contabilidad/ia" => __DIR__ . "/pages/contabilidad/ia.php",

  "contabilidad/catalogos/tipos_cuentas" => __DIR__ . "/pages/contabilidad/tipos_cuentas.php",
  "api/contabilidad_tipos_cuentas_save" => __DIR__ . "/pages/api/contabilidad_tipos_cuentas_save.php",
  "api/contabilidad_tipos_cuentas_delete" => __DIR__ . "/pages/api/contabilidad_tipos_cuentas_delete.php",
  "api/contabilidad_plan_cuentas_save" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_save.php",
  "api/contabilidad_plan_cuentas_delete" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_delete.php",
  "api/contabilidad_plan_cuentas_activate" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_activate.php",
  "api/contabilidad_plan_cuentas_pdf" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_pdf.php",
  "api/contabilidad_plan_cuentas_excel" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_excel.php",
  "api/contabilidad_plan_cuentas_load_model" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_load_model.php",
  "api/contabilidad_plan_cuentas_import" => __DIR__ . "/pages/api/contabilidad_plan_cuentas_import.php",
  "api/contabilidad_tipos_cuentas_pdf"  => __DIR__ . "/pages/api/contabilidad_tipos_cuentas_pdf.php",
  "contabilidad/catalogos/plan_cuentas" => __DIR__ . "/pages/contabilidad/plan_cuentas.php",
  "contabilidad/diario/movimientos" => __DIR__ . "/pages/contabilidad/diario_movimientos.php",
  "contabilidad/diario/buscar" => __DIR__ . "/pages/contabilidad/diario_buscar.php",
  "contabilidad/diario/verificar" => __DIR__ . "/pages/contabilidad/diario_verificar.php",
  "contabilidad/diario/editar" => __DIR__ . "/pages/contabilidad/diario_editar.php",
  "contabilidad/diario/nuevo" => __DIR__ . "/pages/contabilidad/diario_nuevo.php",

  "contabilidad/diario/mayor_general" => __DIR__ . "/pages/contabilidad/mayor_general.php",
  "contabilidad/estados/estado_resultados" => __DIR__ . "/pages/contabilidad/estado_resultados.php",
  "contabilidad/estados/balance_general" => __DIR__ . "/pages/contabilidad/balance_general.php",
  "contabilidad/asignaciones" => __DIR__ . "/pages/contabilidad/asignaciones.php",
  "contabilidad/periodo_contable" => __DIR__ . "/pages/contabilidad/periodo_contable.php",

  // Inventario
  "inventario/home" => __DIR__ . "/pages/inventario/home.php",
  "inventario/reportes" => __DIR__ . "/pages/inventario/reportes.php",
  "inventario/ia" => __DIR__ . "/pages/inventario/ia.php",

  "inventario/items" => __DIR__ . "/pages/inventario/items.php",
  "inventario/cardex" => __DIR__ . "/pages/inventario/cardex.php",
  "inventario/movimientos/entradas" => __DIR__ . "/pages/inventario/placeholder.php",
  "inventario/movimientos/salidas" => __DIR__ . "/pages/inventario/placeholder.php",
  "inventario/ajustes" => __DIR__ . "/pages/inventario/placeholder.php",

  // Compras
  "compras/home" => __DIR__ . "/pages/compras/home.php",
  "compras/ia" => __DIR__ . "/pages/compras/ia.php",

  "compras/ordenes" => __DIR__ . "/pages/compras/placeholder.php",
  "compras/facturas" => __DIR__ . "/pages/compras/placeholder.php",
  "compras/retenciones" => __DIR__ . "/pages/compras/placeholder.php",
  "compras/reportes" => __DIR__ . "/pages/compras/placeholder.php",

  // Clientes/Proveedores
  "clientes/home" => __DIR__ . "/pages/clientes/home.php",
  "clientes/reportes" => __DIR__ . "/pages/clientes/reportes.php",
  "clientes/ia" => __DIR__ . "/pages/clientes/ia.php",

  "proveedores/home" => __DIR__ . "/pages/proveedores/home.php",
  "proveedores/reportes" => __DIR__ . "/pages/proveedores/reportes.php",
  "proveedores/ia" => __DIR__ . "/pages/proveedores/ia.php",

  "clientes/maestro" => __DIR__ . "/pages/clientes/placeholder.php",
  "clientes/cxc" => __DIR__ . "/pages/clientes/placeholder.php",
  "proveedores/maestro" => __DIR__ . "/pages/proveedores/placeholder.php",
  "proveedores/cxp" => __DIR__ . "/pages/proveedores/placeholder.php",

  // Hojas de ruta
  "hojas_ruta/reportes" => __DIR__ . "/pages/hojas_ruta/reportes.php",
  "hojas_ruta/ia" => __DIR__ . "/pages/hojas_ruta/ia.php",

  "hojas_ruta" => __DIR__ . "/pages/hojas_ruta/index.php",
  "hojas_ruta/planificacion" => __DIR__ . "/pages/hojas_ruta/planificacion.php",
  "hojas_ruta/seguimiento" => __DIR__ . "/pages/hojas_ruta/seguimiento.php",

  // Administración
  "administracion/empresa" => __DIR__ . "/pages/administracion/empresa.php",
  "administracion/puntos_venta" => __DIR__ . "/pages/administracion/puntos_venta.php",
  "administracion/autorizaciones" => __DIR__ . "/pages/administracion/autorizaciones.php",
  "administracion/usuarios" => __DIR__ . "/pages/administracion/usuarios.php",
];

if (!isset($map[$r])) {
  flash_set("warning", "Ruta no encontrada: " . $r);
  header("Location: index.php?route=dashboard");
  exit;
}

require $map[$r];