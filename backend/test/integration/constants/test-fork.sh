#!/bin/bash

echo "🚀 Testing Base Fork Integration..."
echo "=================================="

# Vérifier les variables d'environnement
if [ -z "$INFURA_API_KEY" ]; then
    echo "❌ INFURA_API_KEY not set in .env file"
    exit 1
fi

echo "✅ Environment variables OK"

# Test avec le réseau hardhat (recommandé)
echo ""
echo "🔄 Running tests on hardhat network with Base fork..."
npx hardhat test test/integration/integration.fork.test.js --network hardhat

echo ""
echo "📊 Test Summary:"
echo "- Use 'hardhat' network for fork testing (has impersonation support)"
echo "- Tests will skip if prices are stale or whales don't have enough funds"
echo "- Check the console output for detailed funding and price information"