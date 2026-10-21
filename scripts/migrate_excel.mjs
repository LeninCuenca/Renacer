import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Cargar variables de entorno desde .env y .env.local
function loadEnv() {
  const envFiles = [resolve(__dirname, '../.env.local'), resolve(__dirname, '../.env')];
  for (const f of envFiles) {
    if (existsSync(f)) {
      const content = readFileSync(f, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xialcpxahjfabsdywiws.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EXCEL_PATH = resolve('C:/Users/LENOVO LOQ/Desktop/RENACER/DatosMigra/2026-10-CLIENTES 01-OCT-26.xlsx');

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function dbFetch(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} en ${endpoint}: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function cleanText(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  const replacements = {
    'PI\ufffdA': 'PIÑA',
    'PE\ufffdALOZA': 'PEÑALOZA',
    'OCA\ufffdA': 'OCAÑA',
    'OGO\ufffdO': 'OGOÑO',
    'gesti\ufffdn': 'gestión',
    'garant\ufffda': 'garantía',
    '\ufffd': 'Ñ'
  };
  for (const [k, v] of Object.entries(replacements)) {
    s = s.replaceAll(k, v);
  }
  return s;
}

function parseDetalle(detalleString) {
  if (!detalleString) return { cantidad: 1, medida: null, diseno: null, nd: null };
  const text = cleanText(detalleString);

  // 1. Cantidad
  const qtyMatch = text.match(/^(\d+)\s+RE+E?NC[A-Z]*/i);
  const cantidad = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  // 2. Nota de debito (ND)
  const ndMatch = text.match(/ND[-\s]*(\d+)/i);
  const nd = ndMatch ? ndMatch[1] : null;

  // 3. PT parts (ej: PT 29580-MVO260 o multiples PT)
  const ptMatches = [...text.matchAll(/PT\s+([A-Z0-9\/\.\-]+)/gi)].map(m => m[1]);
  let medida = null;
  let diseno = null;

  if (ptMatches.length > 0) {
    if (ptMatches.length === 1) {
      const pt = ptMatches[0];
      if (pt.includes('-')) {
        const parts = pt.split('-');
        medida = parts[0].trim();
        diseno = parts.slice(1).join('-').trim();
      } else {
        medida = pt;
        diseno = pt;
      }
    } else {
      const medidas = [];
      const disenos = [];
      for (const pt of ptMatches) {
        if (pt.includes('-')) {
          const parts = pt.split('-');
          medidas.push(parts[0].trim());
          disenos.push(parts.slice(1).join('-').trim());
        } else {
          medidas.push(pt);
        }
      }
      medida = medidas.join(' / ');
      diseno = disenos.length > 0 ? disenos.join(' / ') : null;
    }
  } else {
    const sizeMatch = text.match(/(\d+[\/\.]\d+[A-Z0-9\.]*)/);
    if (sizeMatch) {
      medida = sizeMatch[1];
      diseno = 'REENCAUCHE';
    } else {
      diseno = text;
    }
  }

  return { cantidad, medida, diseno, nd };
}

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 INICIANDO MIGRACIÓN COMPLETA A SUPABASE (RENACER)');
  console.log('====================================================');

  // 1. Obtener perfiles de la base de datos
  console.log('📡 Consultando perfiles existentes en la base de datos...');
  const perfiles = await dbFetch('perfiles?select=*');
  console.log(`Encontrados ${perfiles.length} perfiles en Supabase:`);
  for (const p of perfiles) {
    console.log(`  - [${p.rol}] ${p.nombre} (ID: ${p.id})`);
  }

  // Buscar perfil de Holger Cuenca
  const holgerPerfil = perfiles.find(p => 
    p.rol === 'vendedor' && 
    (p.nombre?.toLowerCase().includes('holger') || p.apellidos?.toLowerCase().includes('cuenca') || p.nombres?.toLowerCase().includes('holger'))
  ) || perfiles.find(p => p.nombre?.toLowerCase().includes('holger cuenca'));

  if (holgerPerfil) {
    console.log(`\n✅ Perfil de vendedor Holger Cuenca identificado:`);
    console.log(`   ID: ${holgerPerfil.id} | Nombre: ${holgerPerfil.nombre} | Rol: ${holgerPerfil.rol}`);
  } else {
    console.warn(`\n⚠️ ADVERTENCIA: No se encontró perfil para Holger Cuenca.`);
  }

  // 2. Leer archivo Excel
  console.log(`\n📂 Leyendo archivo Excel:\n   ${EXCEL_PATH}`);
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets['Clientes'] || workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // La fila 4 (0-indexada) contiene los encabezados: Fecha, RUC, Cliente, Detalle, Vendedor, Valor Factura total...
  const dataRows = rawRows.slice(5);

  let currentClient = null;
  let clientMap = new Map(); // cedula -> id
  
  // Cargar clientes existentes en Supabase
  const clientesExistentes = await dbFetch('clientes?select=id,cedula,nombre');
  for (const c of clientesExistentes) {
    clientMap.set(c.cedula, c.id);
  }
  console.log(`Clientes ya en BD antes de iniciar: ${clientMap.size}`);

  let stats = {
    clientesNuevos: 0,
    clientesExistentes: 0,
    ordenesCreadas: 0,
    ordenesOmitidas: 0,
    ordenesHolger: 0,
    ordenesSinVendedor: 0,
    itemsCreados: 0,
    abonosCreados: 0,
    totalFacturado: 0,
    totalAbonado: 0,
    totalCarteraPendiente: 0
  };

  console.log('\n⏳ Procesando clientes y facturas...');

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const fechaRaw = row[0];
    const rucRaw = row[1] !== undefined ? String(row[1]).trim() : '';
    const cliRaw = row[2] !== undefined ? String(row[2]).trim() : '';
    const detRaw = row[3] !== undefined ? String(row[3]).trim() : '';
    const vendRaw = row[4] !== undefined ? String(row[4]).trim() : '';
    const valorTotalRaw = row[5];
    const netoRaw = row[6];
    const anticipoRaw = row[7];
    const cxcRaw = row[8];
    const obsRaw = row[9];
    const u10Raw = row[10];
    const u11Raw = row[11];

    // Detectar fila de Cliente (RUC numérico de 10 o 13 dígitos)
    if (rucRaw.match(/^\d+$/)) {
      const cedula = rucRaw;
      const nombreCliente = cleanText(detRaw && detRaw !== '0' && detRaw !== 'nan' ? detRaw : cliRaw);

      let clienteId = clientMap.get(cedula);
      if (!clienteId) {
        const nuevoCliente = await dbFetch('clientes', {
          method: 'POST',
          body: JSON.stringify({
            nombre: nombreCliente,
            cedula: cedula,
            activo: true
          })
        });
        clienteId = nuevoCliente[0].id;
        clientMap.set(cedula, clienteId);
        stats.clientesNuevos++;
      } else {
        stats.clientesExistentes++;
      }

      currentClient = { id: clienteId, cedula, nombre: nombreCliente };
      continue;
    }

    // Detectar fila de Total o fila vacía
    if (rucRaw === 'Total' || cliRaw === 'Total' || !rucRaw) {
      continue;
    }

    // Detectar fila de Factura (RUC comienza con EF-)
    if (rucRaw.startsWith('EF-')) {
      if (!currentClient) {
        console.warn(`Factura ${rucRaw} sin cliente asociado, se omite.`);
        continue;
      }

      const numeroOrden = rucRaw;
      const vendedorExcel = cleanText(vendRaw);
      
      // Asignar vendedor:
      // Si el vendedor en Excel es Cuenca Holger -> asignar ID de Holger Cuenca
      let vendedorId = null;
      const esHolger = vendedorExcel.toLowerCase().includes('cuenca') || vendedorExcel.toLowerCase().includes('holger');
      if (esHolger && holgerPerfil) {
        vendedorId = holgerPerfil.id;
        stats.ordenesHolger++;
      } else {
        stats.ordenesSinVendedor++;
      }

      const total = parseFloat(valorTotalRaw) || 0;
      const neto = parseFloat(netoRaw !== undefined && netoRaw !== null ? netoRaw : cxcRaw) || 0;
      const abonoPrevio = Math.round((total - neto) * 100) / 100;

      // Parsear fecha
      let fechaISO = new Date().toISOString();
      if (fechaRaw) {
        const d = new Date(fechaRaw);
        if (!isNaN(d.getTime())) {
          fechaISO = d.toISOString();
        }
      }

      // Parsear Detalle
      const { cantidad, medida, diseno, nd } = parseDetalle(detRaw);
      const valorUnitario = cantidad > 0 ? Math.round((total / cantidad) * 100) / 100 : total;

      // Armar observaciones
      const obsPartes = [];
      if (obsRaw) obsPartes.push(cleanText(obsRaw));
      if (u10Raw && String(u10Raw).trim()) obsPartes.push(String(u10Raw).trim());
      if (u11Raw && String(u11Raw).trim()) obsPartes.push(cleanText(u11Raw));
      if (nd) obsPartes.push(`ND-${nd}`);
      if (!vendedorId && vendedorExcel && vendedorExcel !== '0') {
        obsPartes.push(`[Vendedor en Excel: ${vendedorExcel}]`);
      }
      const observaciones = obsPartes.join(' | ');

      // Insertar orden
      let ordenId = null;
      try {
        const nuevaOrden = await dbFetch('ordenes', {
          method: 'POST',
          body: JSON.stringify({
            numero: numeroOrden,
            cliente_id: currentClient.id,
            vendedor_id: vendedorId,
            estado: 'Entregado al cliente',
            fecha_rc: fechaISO,
            fecha_ec: fechaISO,
            factura_emitida: true,
            numero_factura: numeroOrden,
            fecha_factura: fechaISO,
            monto_total: total,
            monto_abonado: abonoPrevio > 0 ? abonoPrevio : 0,
            monto_pendiente: neto,
            pagado_completo: neto <= 0,
            activo_vigente: neto > 0,
            observaciones: observaciones
          })
        });
        ordenId = nuevaOrden[0].id;
        stats.ordenesCreadas++;
        stats.totalFacturado += total;
        stats.totalAbonado += (abonoPrevio > 0 ? abonoPrevio : 0);
        stats.totalCarteraPendiente += neto;
      } catch (err) {
        if (err.message.includes('23505') || err.message.includes('duplicate')) {
          stats.ordenesOmitidas++;
          continue;
        } else {
          console.error(`Error al insertar orden ${numeroOrden}:`, err.message);
          continue;
        }
      }

      // Insertar Item
      try {
        await dbFetch('items', {
          method: 'POST',
          body: JSON.stringify({
            orden_id: ordenId,
            cantidad: cantidad,
            media: medida,
            diseno: diseno,
            valor_unitario: valorUnitario,
            observaciones: cleanText(detRaw)
          })
        });
        stats.itemsCreados++;
      } catch (err) {
        console.error(`Error al insertar item para orden ${numeroOrden}:`, err.message);
      }

      // Si hay abono previo (total - neto > 0), insertar en abonos
      if (abonoPrevio > 0) {
        try {
          await dbFetch('abonos', {
            method: 'POST',
            body: JSON.stringify({
              orden_id: ordenId,
              monto: abonoPrevio,
              fecha: fechaISO,
              descripcion: 'Abono / Pago previo registrado en sistema anterior'
            })
          });
          stats.abonosCreados++;
        } catch (err) {
          console.error(`Error al insertar abono para orden ${numeroOrden}:`, err.message);
        }
      }
    }
  }

  console.log('\n====================================================');
  console.log('🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO! 🎉');
  console.log('====================================================');
  console.log(`- Clientes nuevos creados:       ${stats.clientesNuevos}`);
  console.log(`- Facturas / Órdenes creadas:    ${stats.ordenesCreadas}`);
  console.log(`  └ Asignadas a Holger Cuenca:   ${stats.ordenesHolger}`);
  console.log(`  └ Con vendedor pendiente:      ${stats.ordenesSinVendedor} (anotados en observaciones)`);
  console.log(`- Ítems registrados:             ${stats.itemsCreados}`);
  console.log(`- Pagos / Abonos previos:        ${stats.abonosCreados}`);
  console.log('----------------------------------------------------');
  console.log(`- Monto Total Facturado:         $${stats.totalFacturado.toFixed(2)}`);
  console.log(`- Monto Total Cobrado / Abonos:  $${stats.totalAbonado.toFixed(2)}`);
  console.log(`- Cartera Pendiente por Cobrar:  $${stats.totalCarteraPendiente.toFixed(2)}`);
  console.log('====================================================');
  console.log('La aplicación Renacer ya puede visualizar todos los datos.');
}

runMigration().catch(err => {
  console.error('\n❌ ERROR FATAL EN MIGRACIÓN:', err);
  process.exit(1);
});
