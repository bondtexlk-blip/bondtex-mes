import * as XLSX from 'xlsx';

/**
 * Standard column headers matching the Production Orders Directory
 */
export const ORDER_DIRECTORY_COLUMNS = [
  'PO #',
  'RM MATERIAL',
  'COLOUR',
  'SIZE',
  'CATEGORY',
  'STYLE',
  'ORDER QTY',
  'FLOOR QTY',
  'PRODUCTION QTY',
  'DELIVERY QTY',
  'BALANCE QTY',
];

/**
 * Download a pre-formatted Excel template for bulk orders upload
 */
export function downloadOrderTemplate() {
  const sampleData = [
    {
      'PO #': '4502991562',
      'RM MATERIAL': '200150259457H1',
      COLOUR: 'Talc 69-09-47 57H1',
      SIZE: '12',
      CATEGORY: 'Loop',
      STYLE: 'Loop Elastic Band - 57H1',
      'ORDER QTY': 19055,
      'FLOOR QTY': 13827,
      'PRODUCTION QTY': 13827,
      'DELIVERY QTY': 13827,
      'BALANCE QTY': 5228,
    },
    {
      'PO #': '4502991550',
      'RM MATERIAL': '200150259454A2',
      COLOUR: 'Black 093 54A2',
      SIZE: '10',
      CATEGORY: 'Loop',
      STYLE: 'Loop Elastic Band - 54A2',
      'ORDER QTY': 21612,
      'FLOOR QTY': 21612,
      'PRODUCTION QTY': 21612,
      'DELIVERY QTY': 21612,
      'BALANCE QTY': 0,
    },
    {
      'PO #': '4502991599',
      'RM MATERIAL': '200150259465H8',
      COLOUR: 'Praline 65H8',
      SIZE: '14',
      CATEGORY: 'Loop',
      STYLE: 'Loop Elastic Band - 65H8',
      'ORDER QTY': 6408,
      'FLOOR QTY': 6408,
      'PRODUCTION QTY': 6408,
      'DELIVERY QTY': 6408,
      'BALANCE QTY': 0,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: ORDER_DIRECTORY_COLUMNS });
  worksheet['!cols'] = [
    { wch: 15 }, // PO #
    { wch: 18 }, // RM MATERIAL
    { wch: 22 }, // COLOUR
    { wch: 10 }, // SIZE
    { wch: 12 }, // CATEGORY
    { wch: 28 }, // STYLE
    { wch: 14 }, // ORDER QTY
    { wch: 14 }, // FLOOR QTY
    { wch: 16 }, // PRODUCTION QTY
    { wch: 15 }, // DELIVERY QTY
    { wch: 15 }, // BALANCE QTY
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Production Orders');
  XLSX.writeFile(workbook, 'Bondtex_Orders_Upload_Template.xlsx');
}

/**
 * Normalizes a header string for flexible matching
 */
function cleanHeader(header) {
  if (!header) return '';
  return String(header)
    .trim()
    .toUpperCase()
    .replace(/[_\-\s\.\#\/]+/g, '');
}

/**
 * Parses an Excel or CSV file matching directory columns
 */
export async function parseOrdersExcelOrCsv(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Workbook contains no sheets.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('No data rows found in uploaded sheet.');
    }

    const parsedOrders = [];
    const errors = [];

    rawRows.forEach((row, idx) => {
      // Find matching keys
      const normalizedRow = {};
      Object.entries(row).forEach(([key, val]) => {
        normalizedRow[cleanHeader(key)] = val;
      });

      // Extract values with flexible header synonyms
      const poNumber = String(
        normalizedRow['PO'] ||
          normalizedRow['PONUMBER'] ||
          normalizedRow['PURCHASEORDER'] ||
          normalizedRow['PONO'] ||
          ''
      ).trim();

      // Skip completely blank rows
      if (!poNumber && Object.values(normalizedRow).every((v) => v === '')) {
        return;
      }

      if (!poNumber) {
        errors.push(`Row ${idx + 2}: Missing PO Number`);
        return;
      }

      const rmMaterial = String(
        normalizedRow['RMMATERIAL'] ||
          normalizedRow['MATERIAL'] ||
          normalizedRow['RAW'] ||
          normalizedRow['RAWMATERIAL'] ||
          '200150259454A2'
      ).trim();

      const colour = String(
        normalizedRow['COLOUR'] ||
          normalizedRow['COLOR'] ||
          normalizedRow['COLOURWAY'] ||
          'Standard'
      ).trim();

      const size = String(
        normalizedRow['SIZE'] ||
          normalizedRow['SZ'] ||
          '10'
      ).trim();

      const category = String(
        normalizedRow['CATEGORY'] ||
          normalizedRow['CAT'] ||
          'Loop'
      ).trim();

      const style = String(
        normalizedRow['STYLE'] ||
          normalizedRow['STYLENAME'] ||
          normalizedRow['STYLEDESCRIPTION'] ||
          'Loop Elastic Band'
      ).trim();

      const parseNumber = (val, fallback = 0) => {
        if (val === undefined || val === null || val === '') return fallback;
        const cleaned = String(val).replace(/,/g, '').trim();
        const num = Number(cleaned);
        return isNaN(num) ? fallback : num;
      };

      const orderQty = parseNumber(
        normalizedRow['ORDERQTY'] ||
          normalizedRow['ORDERQUANTITY'] ||
          normalizedRow['QTY'] ||
          normalizedRow['ORDER']
      );

      const floorProductionQty = parseNumber(
        normalizedRow['FLOORQTY'] ||
          normalizedRow['FLOORPRODUCTIONQTY'] ||
          normalizedRow['FLOOR'] ||
          normalizedRow['LOOPFLOOR'] ||
          normalizedRow['INSERTQTY'],
        null
      );

      const productionQty = parseNumber(
        normalizedRow['PRODUCTIONQTY'] ||
          normalizedRow['PRODUCTIONQUANTITY'] ||
          normalizedRow['PRODUCTION'] ||
          normalizedRow['PRODUCED']
      );

      const deliveryQty = parseNumber(
        normalizedRow['DELIVERYQTY'] ||
          normalizedRow['DELIVERYQUANTITY'] ||
          normalizedRow['DELIVERY'] ||
          normalizedRow['DELIVERED']
      );

      const rawBalance = normalizedRow['BALANCEQTY'] || normalizedRow['BALANCEQUANTITY'] || normalizedRow['BALANCE'];
      const balanceQty =
        rawBalance !== undefined && rawBalance !== ''
          ? parseNumber(rawBalance)
          : orderQty - deliveryQty;

      // Status
      let status = String(normalizedRow['STATUS'] || '').trim();
      if (!status) {
        if (balanceQty <= 0) {
          status = 'Completed';
        } else if (deliveryQty >= orderQty * 0.9 || productionQty >= orderQty * 0.9) {
          status = 'Ahead';
        } else {
          status = 'On Track';
        }
      }

      parsedOrders.push({
        poNumber,
        rmMaterial,
        colour,
        size,
        category,
        style,
        styleCode: style.split(' - ')[1] || 'LP-NEW',
        orderQty,
        floorProductionQty: floorProductionQty !== null ? floorProductionQty : productionQty,
        productionQty,
        deliveryQty,
        balanceQty,
        deliveryBalanceQty: balanceQty,
        status,
        barcode: `BTX-${poNumber}-${size}`,
      });
    });

    if (parsedOrders.length === 0) {
      throw new Error('No valid order records could be parsed. Check column headers.');
    }

    return {
      success: true,
      orders: parsedOrders,
      errors,
      totalRows: rawRows.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to parse Excel/CSV file',
    };
  }
}
