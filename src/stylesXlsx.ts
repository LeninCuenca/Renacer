import * as XLSX from 'xlsx'

// Exportar función para aplicar estilos después de cargar xlsx-js-style
declare global {
  interface XLSX {
    writeFile(workbook: XLSX.WorkBook, filename: string): void
  }
}

// Estilos predefinidos
export const styles = {
  header: {
    fill: { fgColor: { rgb: 'FF1a3a5e' } }, // Azul oscuro
    font: { bold: true, color: { rgb: 'FFFFFFFF' }, size: 11 }, // Blanco, negrilla
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } }
    }
  },
  clientHeader: {
    fill: { fgColor: { rgb: 'FF1a3a5e' } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } }
    }
  },
  total: {
    fill: { fgColor: { rgb: 'FFe8e8e8' } }, // Gris claro
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } }
    }
  },
  data: {
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } }
    }
  },
  number: {
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '0.00',
    border: {
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } },
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } }
    }
  }
}

export function setCellStyle(worksheet: any, cell: string, style: any) {
  if (!worksheet[cell]) {
    worksheet[cell] = {}
  }
  worksheet[cell].s = style
}
