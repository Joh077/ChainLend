const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendModule", (m) => {
  // Define your constructor parameters here
  const param1 = m.getParameter("param1", "default_value");
  const param2 = m.getParameter("param2", "default_value");
  const param3 = m.getParameter("param3", "default_value");
  const param4 = m.getParameter("param4", "default_value");
  const param5 = m.getParameter("param5", "default_value");
  const param6 = m.getParameter("param6", "default_value");

  const chainLendCore = m.contract("ChainLendCore", [
    param1,
    param2,
    param3,
    param4,
    param5,
    param6
  ]);

  return { chainLendCore };
});