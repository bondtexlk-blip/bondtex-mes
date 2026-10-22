import express from 'express';
import { db } from '../db.js';
import { getNetworkInfo } from '../network.js';

const router = express.Router();

// 1. Factory Overview
router.get('/overview', (req, res) => {
  try {
    const overview = db.getFactoryOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Categories summary (Loop, Strap, T-shirt, Other)
router.get('/categories', (req, res) => {
  try {
    const categories = db.getCategoriesSummary();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Single Category details & metrics
router.get('/categories/:category', (req, res) => {
  try {
    const { category } = req.params;
    const details = db.getCategoryDetails(category);
    if (!details) {
      return res.status(404).json({ success: false, message: `Category '${category}' not found` });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Orders drill-down with rich filters (search, category, style, size, date range, status, sorting)
router.get('/orders', (req, res) => {
  try {
    const result = db.getOrders(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Get Single Order by ID or PO
router.get('/orders/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Create New Order
router.post('/orders', (req, res) => {
  try {
    const { category, orderQty } = req.body;
    if (!category || !orderQty) {
      return res.status(400).json({ success: false, message: 'Category and Order Qty are required' });
    }
    const newOrder = db.addOrder(req.body);
    res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Add Daily Log (Plan vs Actual updates)
router.post('/orders/:id/logs', (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = db.addDailyLog(id, req.body);
    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Dynamic Plan vs Actual Time Series for Charts
router.get('/plan-vs-actual', (req, res) => {
  try {
    const { category = 'All' } = req.query;
    const series = db.getTimeSeries(category);
    res.json({ success: true, category, data: series });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Barcode scan endpoint
router.get('/barcode/:code', (req, res) => {
  try {
    const match = db.lookupBarcode(req.params.code);
    if (!match) {
      return res.status(404).json({ success: false, message: `No order found for barcode: ${req.params.code}` });
    }
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Filter metadata (dropdown options for style, size, category)
router.get('/metadata', (req, res) => {
  try {
    const meta = db.getFilterMetadata();
    res.json({ success: true, data: meta });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Export CSV
router.get('/export/csv', (req, res) => {
  try {
    const { orders } = db.getOrders(req.query);

    const headers = [
      'PO #',
      'RM Material',
      'Colour',
      'Size',
      'Category',
      'Style',
      'Barcode',
      'Order Qty',
      'Production Qty',
      'Delivery Qty',
      'Balance Qty',
      'Status',
      'Start Date',
      'Target Date',
      'Priority',
    ];

    const rows = orders.map((o) => [
      `"${o.poNumber}"`,
      `"${o.rmMaterial || ''}"`,
      `"${(o.colour || '').replace(/"/g, '""')}"`,
      `"${o.size}"`,
      `"${o.category}"`,
      `"${(o.style || '').replace(/"/g, '""')}"`,
      `"${o.barcode}"`,
      o.orderQty,
      o.productionQty,
      o.deliveryQty,
      o.balanceQty,
      `"${o.status}"`,
      `"${o.startDate || ''}"`,
      `"${o.targetDate || ''}"`,
      `"${o.priority}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bondtex_orders_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. Reset to seed
router.post('/reset', (req, res) => {
  try {
    const result = db.reset();
    res.json({ success: true, message: 'Database reset to initial Bondtex seed data', ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. Machines list (Admin & Worker)
router.get('/machines', (req, res) => {
  try {
    const machines = db.getMachines();
    res.json({ success: true, data: machines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 14. Single Machine details
router.get('/machines/:id', (req, res) => {
  try {
    const machine = db.getMachineById(req.params.id);
    if (!machine) {
      return res.status(404).json({ success: false, message: `Machine '${req.params.id}' not found` });
    }
    res.json({ success: true, data: machine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 15. Save Machine Configuration (Admin creates or updates machine & static QR)
router.post('/machines', (req, res) => {
  try {
    const saved = db.saveMachine(req.body);
    res.json({ success: true, data: saved, message: `Machine ${saved.name} configured successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 15B. Delete Machine Station (Admin QR Page)
router.delete('/machines/:id', (req, res) => {
  try {
    const success = db.deleteMachine(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: `Machine '${req.params.id}' not found` });
    }
    res.json({ success: true, message: `Machine '${req.params.id}' removed successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 16. Worker Production Batch Submission (from Mobile Floor QR Scan)
router.post('/worker/submit', (req, res) => {
  try {
    const result = db.submitWorkerProduction(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 17. Local Network IP Information (for physical mobile QR codes on Wi-Fi)
router.get('/network-info', (req, res) => {
  try {
    const net = getNetworkInfo();
    const port = process.env.PORT || 5000;
    res.json({
      success: true,
      data: {
        localIp: net.primaryIp,
        port,
        hostUrl: `http://${net.primaryIp}:${port}`,
        allInterfaces: net.candidateIps,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 18. Worker Management Endpoints
router.get('/workers', (req, res) => {
  try {
    const workers = db.getWorkers();
    res.json({ success: true, data: workers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/workers', (req, res) => {
  try {
    const newWorker = db.addWorker(req.body);
    res.status(201).json({ success: true, data: newWorker, message: 'Worker registered successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/workers/:id', (req, res) => {
  try {
    const updated = db.updateWorker(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }
    res.json({ success: true, data: updated, message: 'Worker updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/workers/:id', (req, res) => {
  try {
    const success = db.deleteWorker(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }
    res.json({ success: true, message: 'Worker deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 19. Dedicated Daily Production Dashboard (Loop focus)
router.get('/daily-production', (req, res) => {
  try {
    const { category = 'Loop', date } = req.query;
    const data = db.getDailyProduction({ category, date });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 20. Machine-wise Hourly Production Dashboard (Target vs Actual, Multiplier & Sync rules)
router.get('/hourly-production', (req, res) => {
  try {
    const data = db.getHourlyProduction(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 21. Delivery & Received Multi-Step Workflow
router.get('/delivery-received', (req, res) => {
  try {
    const data = db.getDeliveryReceivedLogs(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delivery-received', (req, res) => {
  try {
    const result = db.recordDeliveryReceived(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/delivery-received/:id', (req, res) => {
  try {
    const result = db.updateDeliveryReceived(req.params.id, req.body);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/delivery-received/:id', (req, res) => {
  try {
    const result = db.deleteDeliveryReceived(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 22. Outsource Consignments Management & Inbound Return Confirmation
router.get('/outsource-consignments', (req, res) => {
  try {
    const result = db.getOutsourceConsignments(req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/outsource-consignments/:id/receive', (req, res) => {
  try {
    const result = db.receiveOutsourceConsignment(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
