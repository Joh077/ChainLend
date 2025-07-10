import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function HomeMarketPlace() {
  const loanRequests = [
    {
      id: 1,
      name: "Mike B",
      avatar: "MB",
      rating: 4.6,
      completedLoans: 8,
      demandDays: 90,
      amount: "5,000 USDC",
      apr: "9.2%",
      collateral: "5.4 ETH"
    },
    {
      id: 2,
      name: "Lisa W",
      avatar: "LW",
      rating: null,
      completedLoans: 0,
      demandDays: 60,
      amount: "1,200 USDC",
      apr: "8.0%",
      collateral: "1.3 ETH"
    }
  ]

  return (
    <Card className="bg-zinc-900 border-white-500 m-4 mt-8">
      <CardHeader>
        <CardTitle className="text-white text-xl">MarketPlace - Nouvelles demandes</CardTitle>
        <p className="text-gray-400 text-sm">Demandes de prêt disponibles avec les meilleurs rendements</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loanRequests.map((request) => (
          <div key={request.id} className="bg-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              {/* Section gauche - Avatar et infos utilisateur */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-teal-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">{request.avatar}</span>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{request.name}</span>
                    {request.rating ? (
                      <div className="bg-blue-600 px-2 py-1 rounded-full flex items-center space-x-1">
                        <span className="text-yellow-400 text-xs">⭐</span>
                        <span className="text-white text-xs">{request.rating}</span>
                      </div>
                    ) : (
                      <div className="bg-green-600 px-2 py-1 rounded-full flex items-center space-x-1">
                        <span className="text-yellow-400 text-xs">⭐</span>
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {request.completedLoans} prêts complétés • {request.demandDays}j demandés
                  </div>
                </div>
              </div>

              {/* Section centre - Données financières */}
              <div className="flex space-x-16">
                <div className="text-center">
                  <div className="text-white font-medium">{request.amount}</div>
                  <div className="text-gray-400 text-sm">Montant</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-medium">{request.apr}</div>
                  <div className="text-gray-400 text-sm">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-medium">{request.collateral}</div>
                  <div className="text-gray-400 text-sm">Collatéral</div>
                </div>
              </div>

              {/* Section droite - Bouton */}
              <Button 
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full"
              >
                Prêter
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default HomeMarketPlace