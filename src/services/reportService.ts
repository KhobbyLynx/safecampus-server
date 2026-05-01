import { Op } from 'sequelize';
import { Incident, User, Institution } from '../models';
import { sendEmail } from '../lib/email';
import puppeteer from 'puppeteer';

// Helper to generate chart URL
const getChartUrl = (type: string, data: any, options: any = {}) => {
  const chartConfig = {
    type,
    data,
    options: {
      plugins: {
        legend: { display: type === 'pie', position: 'bottom' },
        datalabels: { display: true, color: '#fff' }
      },
      ...options
    }
  };
  return `https://quickchart.io/chart?w=500&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
};

export const startReportGeneratorWorker = () => {
  // Check every minute if a report should be generated
  setInterval(async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon
      const dateOfMonth = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Trigger Weekly Report: Monday at 8:00 AM
      if (dayOfWeek === 1 && hours === 8 && minutes === 0) {
        await generateAndSendReports('WEEKLY');
      }

      // Trigger Monthly Report: 1st of the month at 8:00 AM
      if (dateOfMonth === 1 && hours === 8 && minutes === 0) {
        await generateAndSendReports('MONTHLY');
      }
    } catch (error) {
      console.error('[Report Worker] Error in scheduler:', error);
    }
  }, 60 * 1000);
};

export const generateAndSendReports = async (type: 'WEEKLY' | 'MONTHLY') => {
  console.log(`[Report Worker] Starting ${type} report generation...`);
  try {
    const now = new Date();
    const startDate = new Date();
    
    if (type === 'WEEKLY') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    // Get all institutions except system
    const institutions = await Institution.findAll({
      where: { domain: { [Op.ne]: 'safecampus.edu' } }
    });

    for (const inst of institutions) {
      // Get all school admins for this institution
      const admins = await User.findAll({
        where: {
          institution_id: inst.id,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE'
        }
      });

      if (admins.length === 0) continue;

      // Aggregate Incident Data for the period
      const incidents = await Incident.findAll({
        where: {
          institution_id: inst.id,
          created_at: {
            [Op.gte]: startDate,
            [Op.lte]: now
          }
        }
      });

      const total = incidents.length;
      const resolved = incidents.filter((i: any) => i.status === 'RESOLVED').length;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

      const priorityCounts = { HIGH: 0, CRITICAL: 0, MEDIUM: 0, LOW: 0 };
      const typeCounts: Record<string, number> = {};

      incidents.forEach((i: any) => {
        priorityCounts[i.priority as keyof typeof priorityCounts]++;
        typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;
      });

      // Find top trend
      const topTrend = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      const trendText = topTrend ? `${topTrend[0]} (${topTrend[1]} cases)` : 'None';

      // Priority Chart
      const priorityChartUrl = getChartUrl('bar', {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [priorityCounts.CRITICAL, priorityCounts.HIGH, priorityCounts.MEDIUM, priorityCounts.LOW],
          backgroundColor: ['#dc2626', '#ea580c', '#d97706', '#4b5563']
        }]
      });

      // Type Trend Chart (top 5)
      const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const trendChartUrl = getChartUrl('pie', {
        labels: sortedTypes.map(t => t[0]),
        datasets: [{
          data: sortedTypes.map(t => t[1]),
        }]
      });

      const reportPeriod = type === 'WEEKLY' 
        ? `${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}` 
        : `${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;

      // Generate HTML Template for PDF
      const htmlContent = `
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 40px; background: white; }
            .container { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
            .title { color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -0.5px; }
            .subtitle { color: #6b7280; font-size: 18px; margin: 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .card { background: #f9fafb; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #e5e7eb; }
            .card-value { font-size: 36px; font-weight: 800; color: #111827; margin: 10px 0; }
            .card-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; }
            .section-title { font-size: 20px; font-weight: 700; color: #111827; margin: 40px 0 20px 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; }
            .chart-container { text-align: center; margin-bottom: 40px; padding: 20px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }
            img.chart { max-width: 100%; height: auto; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">SafeCampus Insights</h1>
              <p class="subtitle">${inst.name} • ${type === 'WEEKLY' ? 'Weekly' : 'Monthly'} Safety Report</p>
              <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">${reportPeriod}</p>
            </div>
            
            <div class="grid">
              <div class="card">
                <div class="card-label">Total Incidents</div>
                <div class="card-value">${total}</div>
              </div>
              <div class="card">
                <div class="card-label">Resolution Rate</div>
                <div class="card-value" style="color: ${resolutionRate >= 80 ? '#059669' : '#dc2626'}">${resolutionRate}%</div>
              </div>
            </div>

            <div class="section-title">Severity Breakdown</div>
            <div class="chart-container">
              <img src="${priorityChartUrl}" class="chart" alt="Priority Chart" />
            </div>

            <div class="section-title">Top Incident Trends</div>
            <div class="chart-container">
              ${sortedTypes.length > 0 ? `<img src="${trendChartUrl}" class="chart" alt="Trend Chart" />` : '<p style="color:#6b7280; padding:40px 0;">No incident data available for this period.</p>'}
            </div>

            <div class="footer">
              Generated automatically by SafeCampus Intelligence System.<br>
              Date Generated: ${now.toLocaleString()}
            </div>
          </div>
        </body>
        </html>
      `;

      // Render PDF using Puppeteer
      let pdfBuffer: Buffer | null = null;
      try {
        const browser = await puppeteer.launch({ 
          headless: true, 
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const u8Array = await page.pdf({ 
          format: 'A4', 
          printBackground: true, 
          margin: { top: '40px', bottom: '40px' } 
        });
        pdfBuffer = Buffer.from(u8Array);
        await browser.close();
      } catch (pdfErr) {
        console.error(`[Report Worker] Failed to generate PDF for ${inst.name}:`, pdfErr);
      }

      // Generate simple fallback email body
      const emailBody = `
        <p>Hello Admin,</p>
        <p>Your automated ${type === 'WEEKLY' ? 'Weekly' : 'Monthly'} safety report for ${inst.name} is ready.</p>
        <p><strong>Total Incidents:</strong> ${total}<br>
        <strong>Resolution Rate:</strong> ${resolutionRate}%</p>
        <p>Please find the detailed statistical report attached as a PDF.</p>
      `;

      // Send to all admins of this institution
      for (const admin of admins) {
        try {
          await sendEmail({
            to: admin.email,
            subject: `SafeCampus Analytics: ${type === 'WEEKLY' ? 'Weekly' : 'Monthly'} Safety Report for ${inst.name}`,
            title: `${type === 'WEEKLY' ? 'Weekly' : 'Monthly'} Safety Report`,
            message: emailBody,
            actionText: 'View Full Dashboard Analytics',
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin`,
            attachments: pdfBuffer ? [
              {
                filename: `SafeCampus-${type}-Report-${now.toISOString().split('T')[0]}.pdf`,
                content: Buffer.from(pdfBuffer).toString('base64')
              }
            ] : undefined
          });
        } catch (emailErr) {
          console.error(`[Report Worker] Failed to send report to ${admin.email}:`, emailErr);
        }
      }
    }
    console.log(`[Report Worker] ${type} report generation complete.`);
  } catch (error) {
    console.error(`[Report Worker] Critical Error generating ${type} reports:`, error);
  }
};
