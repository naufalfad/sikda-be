const virtualAssistantService = require('../services/virtualAssistant.service');

const chatWithAssistant = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    const result = await virtualAssistantService.handleChat({ message, history });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chatWithAssistant
};
