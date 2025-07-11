// scripts/getAddresses.js
const fs = require('fs');
const path = require('path');

function getDeployedAddresses() {
  try {
    // Priorité: localhost puis hardhat
    const pathLocalhost = path.join(__dirname, '..', 'ignition', 'deployments', 'chain-localhost', 'deployed_addresses.json');
    const pathHardhat = path.join(__dirname, '..', 'ignition', 'deployments', 'chain-31337', 'deployed_addresses.json');
    
    let addressesPath = pathLocalhost;
    let networkType = "localhost";
    
    if (!fs.existsSync(pathLocalhost) && fs.existsSync(pathHardhat)) {
      addressesPath = pathHardhat;
      networkType = "hardhat";
    } else if (!fs.existsSync(pathLocalhost) && !fs.existsSync(pathHardhat)) {
      console.log('❌ Fichier d\'adresses non trouvé. Avez-vous déployé les contrats ?');
      return;
    }

    const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
    
    console.log(`📋 Adresses des contrats déployés (${networkType}):\n`);
    console.log('// À copier dans ton fichier constants/index.js');
    
    // Gérer les différentes variations de noms
    const chainLendCore = addresses['ChainLendModule#ChainLendCore'];
    const mockERC20 = addresses['ChainLendModule#MockERC20'];
    const clToken = addresses['ChainLendModule#CLToken'];
    const ethPriceFeed = addresses['ChainLendModule#EthPriceFeed'] || addresses['ChainLendModule#ETH_PriceFeed'];
    const usdcPriceFeed = addresses['ChainLendModule#UsdcPriceFeed'] || addresses['ChainLendModule#USDC_PriceFeed'];
    
    console.log(`export const contractAddress = "${chainLendCore}";`);
    console.log(`export const usdcAddress = "${mockERC20}";`);
    console.log(`export const clTokenAddress = "${clToken}";`);
    console.log(`export const ethPriceFeedAddress = "${ethPriceFeed}";`);
    console.log(`export const usdcPriceFeedAddress = "${usdcPriceFeed}";`);
    
    console.log('\n📍 Adresses complètes:');
    Object.entries(addresses).forEach(([name, address]) => {
      const cleanName = name.replace('ChainLendModule#', '');
      console.log(`   ${cleanName.padEnd(15)}: ${address}`);
    });

    console.log(`\n🚀 Prêt pour le frontend sur ${networkType} !`);
    console.log('   1. ✅ Contrats déployés');
    console.log('   2. ✅ Adresses récupérées');
    console.log('   3. 🎯 Copiez les adresses dans constants/index.js');
    console.log('   4. 🧪 Testez votre interface !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

getDeployedAddresses();