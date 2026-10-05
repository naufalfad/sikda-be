const dinkesAiService = require('../services/dinkesAi.service');

/**
 * Controller untuk Fitur AI Automated Executive Report & Briefing Modul Dinas Kesehatan
 */

// 1. Laporan AI Tingkat Faskes Tunggal (Single Faskes Performance & Audit Brief)
// GET /api/dinkes/ai/report/faskes/:id
const getFaskesAiReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const result = await dinkesAiService.generateFaskesReport(id, { startDate, endDate });

    res.status(200).json({
      success: true,
      scope: result.scope,
      generatedAt: result.generatedAt,
      reportMarkdown: result.reportMarkdown,
      rawMetrics: result.rawMetrics
    });
  } catch (error) {
    next(error);
  }
};

// 2. Laporan AI Tingkat Wilayah / Se-Kabupaten (Regency-Wide Macro Situation Report / SitRep)
// GET /api/dinkes/ai/report/wilayah
const getWilayahAiSitRep = async (req, res, next) => {
  try {
    const { startDate, endDate, kecamatan } = req.query;

    const result = await dinkesAiService.generateWilayahSitRep({ startDate, endDate, kecamatan });

    res.status(200).json({
      success: true,
      scope: result.scope,
      generatedAt: result.generatedAt,
      reportMarkdown: result.reportMarkdown,
      rawMetrics: result.rawMetrics
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFaskesAiReport,
  getWilayahAiSitRep
};
