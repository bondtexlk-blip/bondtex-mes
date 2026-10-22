export const initialCategories = [
  {
    id: 'Loop',
    name: 'Loop',
    code: 'LP',
    description: 'Elastic loops, hook & loop fasteners, pull tabs, and ring closures',
    icon: 'RefreshCw',
    color: 'blue',
    gradient: 'from-blue-600 to-indigo-700',
    accentBorder: 'border-blue-500/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    supervisor: 'Kavinda Perera',
    linesActive: 6,
  },
  {
    id: 'Strap',
    name: 'Strap',
    code: 'ST',
    description: 'Nylon webbings, polyester bonded straps, shoulder harnesses & bands',
    icon: 'Layers',
    color: 'emerald',
    gradient: 'from-emerald-600 to-teal-700',
    accentBorder: 'border-emerald-500/30',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-400',
    supervisor: 'Sanjeewa Silva',
    linesActive: 8,
  },
  {
    id: 'T-shirt',
    name: 'T-shirt',
    code: 'TS',
    description: 'Crewneck, polo tees, activewear blanks, seamless knits & garment dyeing',
    icon: 'Shirt',
    color: 'amber',
    gradient: 'from-amber-600 to-orange-700',
    accentBorder: 'border-amber-500/30',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-400',
    supervisor: 'Chamari Wickramasinghe',
    linesActive: 10,
  },
  {
    id: 'Other',
    name: 'Other',
    code: 'OT',
    description: 'Trim accessories, heat-seal patches, cords, tags & specialty textile components',
    icon: 'Boxes',
    color: 'purple',
    gradient: 'from-purple-600 to-pink-700',
    accentBorder: 'border-purple-500/30',
    accentBg: 'bg-purple-500/10',
    accentText: 'text-purple-400',
    supervisor: 'Nuwan Bandara',
    linesActive: 4,
  },
];

const getPastDateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const getFutureDateStr = (daysAhead) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

// Exact Real Production Orders directly matching the Factory Production Sheet
export const rawProductionRows = [
  // PO 4502991550 | 200150259454A2 | Black 033 54A2 | Loop
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 033 54A2', size: '10', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 21612, productionQty: 21612, deliveryQty: 21612, status: 'Completed' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 033 54A2', size: '12', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 24496, productionQty: 24496, deliveryQty: 24496, status: 'Completed' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 033 54A2', size: '14', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 6700, productionQty: 6700, deliveryQty: 6700, status: 'Completed' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 033 54A2', size: '16', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 756, productionQty: 755, deliveryQty: 755, status: 'Ahead' },

  // PO 4502991532 | 200150259439H6 | Marzipan 39H6 | Strap
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '10', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 35003, productionQty: 34003, deliveryQty: 32000, status: 'Ahead' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '12', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 20874, productionQty: 18550, deliveryQty: 17000, status: 'Ahead' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '14', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 1351, productionQty: 1353, deliveryQty: 1351, status: 'Completed' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '16', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 447, productionQty: 450, deliveryQty: 447, status: 'Completed' },

  // PO 4502991599 | 200150259465H8 | Praline 65H8 | T-shirt
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '10', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 61714, productionQty: 41200, deliveryQty: 38000, status: 'Behind Plan' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '12', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 31682, productionQty: 11000, deliveryQty: 10000, status: 'Behind Plan' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '14', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 6408, productionQty: 1000, deliveryQty: 800, status: 'Behind Plan' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '16', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 291, productionQty: 297, deliveryQty: 291, status: 'Completed' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '18', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 64, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991520 | 200150259433F6 | Ganache 33F6 | Other
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '10', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 923, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '12', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 2506, productionQty: 1800, deliveryQty: 1500, status: 'Behind Plan' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '14', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 2420, productionQty: 1400, deliveryQty: 1200, status: 'Behind Plan' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '16', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 1500, productionQty: 275, deliveryQty: 250, status: 'Behind Plan' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '18', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 214, productionQty: 216, deliveryQty: 214, status: 'Completed' },

  // PO 4502991562 | 200150259457H1 | Talc 69-09-47 57H1 | Other
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '10', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 29699, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '12', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 19055, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '14', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 3260, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '16', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 451, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '18', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 63, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
];

export const initialMachines = [
  {
    id: 'MCH-01',
    code: 'MCH-01',
    name: 'Machine 01',
    type: 'High Speed Elastic Loom L1',
    category: 'Loop',
    operatorName: 'Sunil Perera',
    shift: 'Day Shift',
    status: 'Active',
    dailyTargetQty: 5000,
    assignedStyles: ['Loop Elastic Band - 54A2'],
    assignedColours: ['Black 033 54A2'],
    assignedSizes: ['10', '12', '14', '16'],
    assignedPos: ['4502991550'],
    qrPayload: 'MCH-01',
    notes: 'Primary elastic loop line (PO 4502991550 - Black 033 54A2)',
    todayLogs: [],
  },
  {
    id: 'MCH-02',
    code: 'MCH-02',
    name: 'Machine 02',
    type: 'Webbing Loom W2',
    category: 'Strap',
    operatorName: 'Pradeep Silva',
    shift: 'Day Shift',
    status: 'Active',
    dailyTargetQty: 4000,
    assignedStyles: ['Strap Webbing Band - 39H6'],
    assignedColours: ['Marzipan 39H6'],
    assignedSizes: ['10', '12', '14', '16'],
    assignedPos: ['4502991532'],
    qrPayload: 'MCH-02',
    notes: 'Nylon bonding strap section (PO 4502991532 - Marzipan 39H6)',
    todayLogs: [],
  },
  {
    id: 'MCH-03',
    code: 'MCH-03',
    name: 'Machine 03',
    type: 'Santoni Circular Knit C3',
    category: 'T-shirt',
    operatorName: 'Chamari Wickramasinghe',
    shift: 'Day Shift',
    status: 'Active',
    dailyTargetQty: 6000,
    assignedStyles: ['T-Shirt Combed Knit - 65H8'],
    assignedColours: ['Praline 65H8'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991599'],
    qrPayload: 'MCH-03',
    notes: 'Continuous circular knitting cylinder (PO 4502991599 - Praline 65H8)',
    todayLogs: [],
  },
  {
    id: 'MCH-04',
    code: 'MCH-04',
    name: 'Machine 04',
    type: 'Ultrasonic Trim Slitter U4',
    category: 'Other',
    operatorName: 'Roshan Kumara',
    shift: 'Day Shift',
    status: 'Active',
    dailyTargetQty: 1500,
    assignedStyles: ['Specialty Trim Finish - 33F6'],
    assignedColours: ['Ganache 33F6'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991520'],
    qrPayload: 'MCH-04',
    notes: 'Precision cold/hot slitter (PO 4502991520 - Ganache 33F6)',
    todayLogs: [],
  },
  {
    id: 'MCH-05',
    code: 'MCH-05',
    name: 'Machine 05',
    type: 'Multi-Bed Thermal Press T5',
    category: 'Other',
    operatorName: 'Dinesh Bandara',
    shift: 'Day Shift',
    status: 'Active',
    dailyTargetQty: 3000,
    assignedStyles: ['Technical Finish Trim - 57H1'],
    assignedColours: ['Talc 69-09-47 57H1'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991562'],
    qrPayload: 'MCH-05',
    notes: 'Heat seal and adhesive curing bed (PO 4502991562 - Talc 69-09-47 57H1)',
    todayLogs: [],
  },
];

export const initialWorkers = [
  { id: 'WRK-01', name: 'Sunil Perera', empId: 'EMP-1041', category: 'Loop', shift: 'Day Shift', status: 'Active', phone: '+94 77 123 4567', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-02', name: 'Kavinda Perera', empId: 'EMP-1042', category: 'Loop', shift: 'Day Shift', status: 'Active', phone: '+94 77 234 5678', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-03', name: 'Nimal Jayawardena', empId: 'EMP-1043', category: 'Loop', shift: 'Day Shift', status: 'Active', phone: '+94 77 345 6789', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-04', name: 'Pradeep Silva', empId: 'EMP-1044', category: 'Strap', shift: 'Day Shift', status: 'Active', phone: '+94 77 456 7890', assignedMachine: 'MCH-02', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-05', name: 'Ruwan Gamage', empId: 'EMP-1045', category: 'Strap', shift: 'Day Shift', status: 'Active', phone: '+94 77 567 8901', assignedMachine: 'MCH-02', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-06', name: 'Chamari Wickramasinghe', empId: 'EMP-1046', category: 'T-shirt', shift: 'Day Shift', status: 'Active', phone: '+94 77 678 9012', assignedMachine: 'MCH-03', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-07', name: 'Kusum Fernando', empId: 'EMP-1047', category: 'T-shirt', shift: 'Night Shift', status: 'Active', phone: '+94 77 789 0123', assignedMachine: 'MCH-03', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-08', name: 'Roshan Kumara', empId: 'EMP-1048', category: 'Other', shift: 'Day Shift', status: 'Active', phone: '+94 77 890 1234', assignedMachine: 'MCH-04', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-09', name: 'Dinesh Bandara', empId: 'EMP-1049', category: 'Other', shift: 'Night Shift', status: 'Active', phone: '+94 77 901 2345', assignedMachine: 'MCH-05', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
];

export const initialProductionLogs = [];

export const initialOrders = rawProductionRows.map((row, idx) => {
  const id = `ORD-${String(idx + 1).padStart(3, '0')}`;
  const barcode = `BTX-${row.poNumber}-${row.size}`;
  const balanceQty = Math.max(0, row.orderQty - row.productionQty);
  const deliveryBalanceQty = Math.max(0, row.orderQty - row.deliveryQty);

  return {
    id,
    poNumber: row.poNumber,
    rmMaterial: row.rmMaterial,
    colour: row.colour,
    size: row.size,
    category: row.category,
    style: row.style,
    styleCode: row.styleCode,
    barcode,
    orderQty: row.orderQty,
    productionQty: row.productionQty,
    deliveryQty: row.deliveryQty,
    balanceQty,
    deliveryBalanceQty,
    startDate: getPastDateStr(14 + (idx % 7)),
    targetDate: getFutureDateStr(6 + (idx % 8)),
    status: row.status,
    priority: idx % 3 === 0 ? 'High' : idx % 4 === 0 ? 'Critical' : 'Normal',
    dailyLogs: row.productionQty > 0 ? [
      {
        date: getPastDateStr(1),
        planQty: Math.round(row.orderQty / 5),
        actualQty: row.productionQty,
        deliveryQty: row.deliveryQty,
        notes: 'Factory verified production records',
      }
    ] : [],
  };
});
