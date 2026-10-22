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

// No mock daily logs - daily logs are generated solely by actual factory floor entries and submissions


// Raw Structured Reference Data directly matching the user's Excel/Database table
// Initialized clean with productionQty: 0, deliveryQty: 0, status: 'Scheduled'
export const rawProductionRows = [
  // PO 4502991550 | 200150259454A2 | Black 093 54A2 | Loop
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '10', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 18000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '12', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 22000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '14', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 25000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991550', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '16', category: 'Loop', style: 'Loop Elastic Band - 54A2', styleCode: 'LP-54A2', orderQty: 15000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991532 | 200150259439H6 | Marzipan 39H6 | Strap
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '10', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 16000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '12', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 24000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '14', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 28000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991532', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '16', category: 'Strap', style: 'Strap Webbing Band - 39H6', styleCode: 'ST-39H6', orderQty: 14000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991599 | 200150259465H8 | Praline 65H8 | T-shirt
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '10', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 30000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '12', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 45000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '14', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 50000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '16', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 35000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991599', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '18', category: 'T-shirt', style: 'T-Shirt Combed Knit - 65H8', styleCode: 'TS-65H8', orderQty: 20000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991520 | 200150259433F6 | Ganache 33F6 | Other
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '10', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 25000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '12', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 35000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '14', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 40000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '16', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 22000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991520', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '18', category: 'Other', style: 'Specialty Trim Finish - 33F6', styleCode: 'OT-33F6', orderQty: 15000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991562 | 200150259457H1 | Talc 69-09-47 57H1 | Other
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '10', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 28000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '12', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 32000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '14', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 38000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '16', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 20000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991562', rmMaterial: '200150259457H1', colour: 'Talc 69-09-47 57H1', size: '18', category: 'Other', style: 'Technical Finish Trim - 57H1', styleCode: 'OT-57H1', orderQty: 12000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991557 | 200150259454A2 | Black 093 54A2 | Loop
  { poNumber: '4502991557', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '10', category: 'Loop', style: 'Loop Fastener Trim - 54A2', styleCode: 'LP-54A2', orderQty: 15000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991557', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '12', category: 'Loop', style: 'Loop Fastener Trim - 54A2', styleCode: 'LP-54A2', orderQty: 20000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991557', rmMaterial: '200150259454A2', colour: 'Black 093 54A2', size: '14', category: 'Loop', style: 'Loop Fastener Trim - 54A2', styleCode: 'LP-54A2', orderQty: 18000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991538 | 200150259439H6 | Marzipan 39H6 | Strap
  { poNumber: '4502991538', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '10', category: 'Strap', style: 'Strap Bonded Band - 39H6', styleCode: 'ST-39H6', orderQty: 14000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991538', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '12', category: 'Strap', style: 'Strap Bonded Band - 39H6', styleCode: 'ST-39H6', orderQty: 18000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991538', rmMaterial: '200150259439H6', colour: 'Marzipan 39H6', size: '14', category: 'Strap', style: 'Strap Bonded Band - 39H6', styleCode: 'ST-39H6', orderQty: 16000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991603 | 200150259465H8 | Praline 65H8 | T-shirt
  { poNumber: '4502991603', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '10', category: 'T-shirt', style: 'T-Shirt Seamless - 65H8', styleCode: 'TS-65H8', orderQty: 22000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991603', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '12', category: 'T-shirt', style: 'T-Shirt Seamless - 65H8', styleCode: 'TS-65H8', orderQty: 26000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991603', rmMaterial: '200150259465H8', colour: 'Praline 65H8', size: '14', category: 'T-shirt', style: 'T-Shirt Seamless - 65H8', styleCode: 'TS-65H8', orderQty: 24000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },

  // PO 4502991526 | 200150259433F6 | Ganache 33F6 | Other
  { poNumber: '4502991526', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '10', category: 'Other', style: 'Specialty Binding Trim - 33F6', styleCode: 'OT-33F6', orderQty: 18000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991526', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '12', category: 'Other', style: 'Specialty Binding Trim - 33F6', styleCode: 'OT-33F6', orderQty: 22000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
  { poNumber: '4502991526', rmMaterial: '200150259433F6', colour: 'Ganache 33F6', size: '14', category: 'Other', style: 'Specialty Binding Trim - 33F6', styleCode: 'OT-33F6', orderQty: 20000, productionQty: 0, deliveryQty: 0, status: 'Scheduled' },
];

export const initialMachines = [
  {
    id: 'MCH-01',
    code: 'MCH-01',
    name: 'Machine 01',
    type: 'High Speed Elastic Loom L1',
    category: 'Loop',
    operatorName: 'Sunil Perera',
    shift: 'Shift A',
    status: 'Active',
    dailyTargetQty: 2500,
    assignedStyles: ['Loop Elastic Band - 54A2'],
    assignedColours: ['Black 093 54A2'],
    assignedSizes: ['10', '12', '14', '16'],
    assignedPos: ['4502991550', '4502991557'],
    qrPayload: 'MCH-01',
    notes: 'Primary elastic loop line with auto tension feed',
    todayLogs: [],
  },
  {
    id: 'MCH-02',
    code: 'MCH-02',
    name: 'Machine 02',
    type: 'Webbing Loom W2',
    category: 'Strap',
    operatorName: 'Pradeep Silva',
    shift: 'Shift A',
    status: 'Active',
    dailyTargetQty: 3000,
    assignedStyles: ['Strap Webbing Band - 39H6'],
    assignedColours: ['Marzipan 39H6'],
    assignedSizes: ['10', '12', '14', '16'],
    assignedPos: ['4502991532', '4502991538'],
    qrPayload: 'MCH-02',
    notes: 'Nylon bonding strap section',
    todayLogs: [],
  },
  {
    id: 'MCH-03',
    code: 'MCH-03',
    name: 'Machine 03',
    type: 'Santoni Circular Knit C3',
    category: 'T-shirt',
    operatorName: 'Chamari Wickramasinghe',
    shift: 'Shift A',
    status: 'Active',
    dailyTargetQty: 4000,
    assignedStyles: ['T-Shirt Combed Knit - 65H8', 'T-Shirt Seamless - 65H8'],
    assignedColours: ['Praline 65H8'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991599', '4502991603'],
    qrPayload: 'MCH-03',
    notes: 'Continuous circular knitting cylinder 28 gauge',
    todayLogs: [],
  },
  {
    id: 'MCH-04',
    code: 'MCH-04',
    name: 'Machine 04',
    type: 'Ultrasonic Trim Slitter U4',
    category: 'Other',
    operatorName: 'Roshan Kumara',
    shift: 'Shift A',
    status: 'Active',
    dailyTargetQty: 3200,
    assignedStyles: ['Specialty Trim Finish - 33F6'],
    assignedColours: ['Ganache 33F6'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991520', '4502991526'],
    qrPayload: 'MCH-04',
    notes: 'Precision cold/hot slitter with optical guide',
    todayLogs: [],
  },
  {
    id: 'MCH-05',
    code: 'MCH-05',
    name: 'Machine 05',
    type: 'Multi-Bed Thermal Press T5',
    category: 'Other',
    operatorName: 'Dinesh Bandara',
    shift: 'Shift B',
    status: 'Active',
    dailyTargetQty: 2600,
    assignedStyles: ['Technical Finish Trim - 57H1'],
    assignedColours: ['Talc 69-09-47 57H1'],
    assignedSizes: ['10', '12', '14', '16', '18'],
    assignedPos: ['4502991562'],
    qrPayload: 'MCH-05',
    notes: 'Heat seal and adhesive curing bed',
    todayLogs: [],
  },
];

export const initialWorkers = [
  { id: 'WRK-01', name: 'Sunil Perera', empId: 'EMP-1041', category: 'Loop', shift: 'Shift A', status: 'Active', phone: '+94 77 123 4567', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-02', name: 'Kavinda Perera', empId: 'EMP-1042', category: 'Loop', shift: 'Shift B', status: 'Active', phone: '+94 77 234 5678', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-03', name: 'Nimal Jayawardena', empId: 'EMP-1043', category: 'Loop', shift: 'Shift A', status: 'Active', phone: '+94 77 345 6789', assignedMachine: 'MCH-01', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-04', name: 'Pradeep Silva', empId: 'EMP-1044', category: 'Strap', shift: 'Shift A', status: 'Active', phone: '+94 77 456 7890', assignedMachine: 'MCH-02', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-05', name: 'Ruwan Gamage', empId: 'EMP-1045', category: 'Strap', shift: 'Shift B', status: 'Active', phone: '+94 77 567 8901', assignedMachine: 'MCH-02', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-06', name: 'Chamari Wickramasinghe', empId: 'EMP-1046', category: 'T-shirt', shift: 'Shift A', status: 'Active', phone: '+94 77 678 9012', assignedMachine: 'MCH-03', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-07', name: 'Kusum Fernando', empId: 'EMP-1047', category: 'T-shirt', shift: 'Shift B', status: 'Active', phone: '+94 77 789 0123', assignedMachine: 'MCH-03', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-08', name: 'Roshan Kumara', empId: 'EMP-1048', category: 'Other', shift: 'Shift A', status: 'Active', phone: '+94 77 890 1234', assignedMachine: 'MCH-04', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
  { id: 'WRK-09', name: 'Dinesh Bandara', empId: 'EMP-1049', category: 'Other', shift: 'Shift B', status: 'Active', phone: '+94 77 901 2345', assignedMachine: 'MCH-05', todayProduced: 0, todayOutput: 0, batchesLogged: 0 },
];

export const initialProductionLogs = [];

export const initialOrders = rawProductionRows.map((row, idx) => {
  const id = `ORD-${String(idx + 1).padStart(3, '0')}`;
  const barcode = `BTX-${row.poNumber}-${row.size}`;
  const balanceQty = row.orderQty;
  const deliveryBalanceQty = row.orderQty;

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
    productionQty: 0,
    deliveryQty: 0,
    balanceQty,
    deliveryBalanceQty,
    startDate: getPastDateStr(14 + (idx % 7)),
    targetDate: getFutureDateStr(6 + (idx % 8)),
    status: 'Scheduled',
    priority: idx % 3 === 0 ? 'High' : idx % 4 === 0 ? 'Critical' : 'Normal',
    dailyLogs: [],
  };
});
