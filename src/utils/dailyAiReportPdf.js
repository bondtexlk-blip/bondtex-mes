// Daily AI Production Plan & Material Analysis PDF Exporter
// Bondtex Manufacturing Execution System (MES)

import { jsPDF } from 'jspdf';

/**
 * Generates and downloads the Daily AI Production Report PDF
 */
export function exportDailyAiPlanPdf({
  plan,
  order,
  materials = [],
  aiAnalysis = null,
  adaptiveForecast = null,
  continuousDates = [],
  targetDate = new Date().toISOString().split('T')[0],
}) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182 mm
    let currentY = 0;

    const checkPageBreak = (neededHeight) => {
      if (currentY + neededHeight > pageHeight - 18) {
        doc.addPage();
        drawHeaderMinimal();
        currentY = 22;
      }
    };

    const drawHeaderMinimal = () => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setFillColor(56, 189, 248); // sky-400
      doc.rect(0, 12, pageWidth, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('BONDTEX MES &bull; DAILY PRODUCTION & MATERIAL REPORT', margin, 8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${targetDate}`, pageWidth - margin - 25, 8);
    };

    // ==========================================
    // 1. PRIMARY COVER HEADER
    // ==========================================
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 36, 'F');

    // Accent line (sky-400)
    doc.setFillColor(56, 189, 248);
    doc.rect(0, 36, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BONDTEX APPAREL & NARROW FABRIC MANUFACTURING', margin, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('MES DAILY PRODUCTION SCHEDULE & AI MATERIAL CONSUMPTION REPORT', margin, 21);

    const nowStr = new Date().toLocaleString();
    doc.setFontSize(8);
    doc.setTextColor(56, 189, 248);
    doc.text(`Target Date: ${targetDate}  |  Generated: ${nowStr}  |  System: Bondtex AI-MES v2.0`, margin, 29);

    currentY = 44;

    // ==========================================
    // 2. ORDER & BATCH SPECIFICATIONS BOX
    // ==========================================
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, currentY, contentWidth, 30, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('PRODUCTION ORDER SPECIFICATIONS & ACTIVE PARAMETERS', margin + 4, currentY + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const col1X = margin + 4;
    const col2X = margin + 65;
    const col3X = margin + 125;

    doc.text(`PO Number: ${order?.poNumber || plan?.orderPoNumber || 'N/A'}`, col1X, currentY + 14);
    doc.text(`Style: ${order?.style || plan?.orderStyle || 'Loop Elastic'}`, col1X, currentY + 20);
    doc.text(`Colour: ${order?.colour || plan?.orderColour || 'Standard'}`, col1X, currentY + 26);

    doc.text(`Size: Size ${order?.size || plan?.orderSize || '12'}`, col2X, currentY + 14);
    doc.text(`Total Order Qty: ${(order?.orderQty || plan?.totalQuantity || 0).toLocaleString()} pcs`, col2X, currentY + 20);
    doc.text(`Scheduled Target Qty: ${(plan?.targetQuantity || order?.balanceQty || 0).toLocaleString()} pcs`, col2X, currentY + 26);

    doc.text(`Working Days: ${plan?.workingDaysCount || 'N/A'} days`, col3X, currentY + 14);
    doc.text(`Ramp-up Profile: ${plan?.rampUp || 'Capacity Standard'}`, col3X, currentY + 20);
    doc.text(`Assigned Machines: ${(plan?.assignedMachines || []).length} units`, col3X, currentY + 26);

    currentY += 36;

    // ==========================================
    // 3. AI-DRIVEN DAILY PRODUCTION ANALYSIS
    // ==========================================
    doc.setFillColor(240, 249, 255); // sky-50
    doc.setDrawColor(186, 230, 253); // sky-200
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199); // sky-600
    doc.text('AI PRODUCTION & MATERIAL USAGE ANALYSIS (GEMINI AI ENGINE)', margin + 4, currentY + 5.5);

    currentY += 12;

    const renderAiSection = (title, content, bgColor = [255, 255, 255]) => {
      if (!content) return;
      const lines = doc.splitTextToSize(content, contentWidth - 8);
      const boxHeight = lines.length * 4.2 + 10;

      checkPageBreak(boxHeight + 4);

      doc.setFillColor(...bgColor);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

      // Title pill
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(title, margin + 4, currentY + 5.5);

      // Body text
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(lines, margin + 4, currentY + 10.5);

      currentY += boxHeight + 4;
    };

    if (aiAnalysis) {
      renderAiSection(
        '1. RUNNING PRODUCTION & ACTIVE ITEMS TODAY',
        aiAnalysis.runningProductionToday || 'Machines scheduled for continuous loop production and sizing.',
        [248, 250, 252]
      );

      renderAiSection(
        '2. EXPECTED BATCH & ORDER COMPLETIONS TODAY',
        aiAnalysis.expectedCompletionsToday || 'Daily milestone scheduled for scheduled delivery pacing.',
        [248, 250, 252]
      );

      renderAiSection(
        '3. PRODUCTION TARGETS & MATERIAL USAGE BREAKDOWN',
        aiAnalysis.productionTargetsAndMaterials || 'Material allocations calculated to sustain planned machine hourly rates.',
        [248, 250, 252]
      );

      if (aiAnalysis.lineBalancingAndRisks) {
        renderAiSection(
          '4. LINE BALANCING, BUFFER ALLOCATION & RISK ADVICE',
          aiAnalysis.lineBalancingAndRisks,
          [254, 252, 232] // amber-50
        );
      }
    } else {
      renderAiSection(
        'EXECUTIVE PRODUCTION STRATEGY',
        plan?.aiStrategySummary ||
          `Daily production capacity allocated across ${(plan?.assignedMachines || []).length} machines to achieve targeted output with minimal changeover downtime.`,
        [248, 250, 252]
      );
    }

    // Adaptive Forecast Section (if present)
    if (adaptiveForecast) {
      const forecastText = `${adaptiveForecast.deficitSurplusAnalysis || ''}\n\nRECALIBRATED DAILY TARGET: ${(adaptiveForecast.recalibratedDailyTarget || 0).toLocaleString()} pcs/day across remaining ${adaptiveForecast.remainingDaysCount || 1} working days.\n\nACTION RECOMMENDATIONS:\n${(adaptiveForecast.correctiveActions || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
      renderAiSection(
        `DYNAMIC AI SCHEDULE FORECAST (${adaptiveForecast.paceStatus || 'Adaptive Tracking'})`,
        forecastText,
        adaptiveForecast.netVariance < 0 ? [254, 242, 242] : [240, 253, 244]
      );
    }

    // ==========================================
    // 4. MANUAL MATERIAL & INVENTORY INPUT TABLE
    // ==========================================
    checkPageBreak(35);

    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208); // emerald-200
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('REQUIRED RAW MATERIALS & INVENTORY USAGE REQUIREMENTS', margin + 4, currentY + 5.5);

    currentY += 11;

    // Table Header
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    doc.text('#', margin + 3, currentY + 4.2);
    doc.text('Material / Inventory Item', margin + 12, currentY + 4.2);
    doc.text('Required Qty', margin + 95, currentY + 4.2);
    doc.text('Unit', margin + 125, currentY + 4.2);
    doc.text('Notes / Specifications', margin + 145, currentY + 4.2);

    currentY += 6;

    if (materials && materials.length > 0) {
      materials.forEach((mat, idx) => {
        checkPageBreak(7);
        const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
        doc.setFillColor(...rowBg);
        doc.rect(margin, currentY, contentWidth, 6.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, currentY + 6.5, margin + contentWidth, currentY + 6.5);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        doc.text(String(idx + 1), margin + 3, currentY + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(String(mat.name || 'Unnamed Material').slice(0, 38), margin + 12, currentY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(Number(mat.quantity || 0).toLocaleString(), margin + 95, currentY + 4.5);
        doc.text(String(mat.unit || 'pcs'), margin + 125, currentY + 4.5);
        doc.text(String(mat.notes || '-').slice(0, 25), margin + 145, currentY + 4.5);

        currentY += 6.5;
      });
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, currentY, contentWidth, 7, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('No manual materials added yet. Standard default yield applied.', margin + 12, currentY + 4.5);
      currentY += 7;
    }

    currentY += 6;

    // ==========================================
    // 5. MACHINE-WISE TARGET ALLOCATION TABLE
    // ==========================================
    checkPageBreak(35);

    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text('MACHINE-WISE DAILY PRODUCTION TARGET ALLOCATION', margin + 4, currentY + 5.5);

    currentY += 11;

    // Table Header
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    doc.text('Machine', margin + 4, currentY + 4.2);
    doc.text('Type', margin + 35, currentY + 4.2);
    doc.text('Operator', margin + 85, currentY + 4.2);
    doc.text('Daily Capacity', margin + 125, currentY + 4.2);
    doc.text('Day Target', margin + 155, currentY + 4.2);

    currentY += 6;

    const assignedMachines = plan?.assignedMachines || [];
    const targetDaySchedule = (plan?.scheduleDays || []).find((d) => d.date === targetDate) || plan?.scheduleDays?.[0];

    assignedMachines.forEach((m, idx) => {
      checkPageBreak(7);
      const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...rowBg);
      doc.rect(margin, currentY, contentWidth, 6.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY + 6.5, margin + contentWidth, currentY + 6.5);

      const mDayPlan = targetDaySchedule?.machineDailyPlans?.find((mdp) => mdp.machineId === m.id || mdp.machineCode === m.code);
      const targetPcs = mDayPlan ? mDayPlan.dailyTarget : m.dailyTargetQty || 2600;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${m.name} (${m.code})`, margin + 4, currentY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(String(m.type || 'Loom').slice(0, 24), margin + 35, currentY + 4.5);
      doc.text(String(m.operatorName || 'Assigned Operator').slice(0, 20), margin + 85, currentY + 4.5);
      doc.text(`${(m.dailyTargetQty || 2600).toLocaleString()} pcs`, margin + 125, currentY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text(`${targetPcs.toLocaleString()} pcs`, margin + 155, currentY + 4.5);

      currentY += 6.5;
    });

    currentY += 12;

    // ==========================================
    // 6. SIGN-OFF AUTHORIZATION
    // ==========================================
    checkPageBreak(30);

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 6;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);

    const signW = contentWidth / 3;
    doc.text('PREPARED BY: Planning Engineer', margin + 4, currentY + 4);
    doc.line(margin + 4, currentY + 15, margin + signW - 8, currentY + 15);

    doc.text('VERIFIED BY: Shift Production Manager', margin + signW + 4, currentY + 4);
    doc.line(margin + signW + 4, currentY + 15, margin + signW * 2 - 8, currentY + 15);

    doc.text('APPROVED BY: Factory Operations Head', margin + signW * 2 + 4, currentY + 4);
    doc.line(margin + signW * 2 + 4, currentY + 15, margin + contentWidth - 4, currentY + 15);

    // Save and trigger download
    const fileName = `bondtex-daily-ai-report-${targetDate}.pdf`;
    doc.save(fileName);
    return { success: true, fileName };
  } catch (err) {
    console.error('Failed to export Daily AI Report PDF:', err);
    throw err;
  }
}
