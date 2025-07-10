import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ActiveLoans() {
  const loans = [
    {
      id: 1,
      name: "Alice S",
      avatar: "AS",
      rating: 4.9,
      completedLoans: 25,
      remainingDays: 12,
      amount: "2,500 USDC",
      apr: "7.8%",
      collateral: "2.8 ETH"
    },
    {
      id: 2,
      name: "Bob D",
      avatar: "BD",
      rating: 4.8,
      completedLoans: 12,
      remainingDays: 45,
      amount: "1,000 USDC",
      apr: "8.5%",
      collateral: "1.2 ETH"
    }
  ]

  return (
    <Card className="bg-zinc-900 border-white-500 m-4">
      <CardHeader>
        <CardTitle className="text-white text-xl">Mes prêts actifs</CardTitle>
        <p className="text-gray-400 text-sm">Prêts en cours avec surveillance temps réel</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loans.map((loan) => (
          <div key={loan.id} className="bg-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              {/* Section gauche - Avatar et infos utilisateur */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-teal-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">{loan.avatar}</span>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{loan.name}</span>
                    <div className="bg-green-600 px-2 py-1 rounded-full flex items-center space-x-1">
                      <span className="text-yellow-400 text-xs">⭐</span>
                      <span className="text-white text-xs">{loan.rating}</span>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {loan.completedLoans} prêts complétés • {loan.remainingDays}j restants
                  </div>
                </div>
              </div>

              {/* Section centre - Données financières */}
              <div className="flex space-x-16">
                <div className="text-center">
                  <div className="text-white font-medium">{loan.amount}</div>
                  <div className="text-gray-400 text-sm">Montant</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-medium">{loan.apr}</div>
                  <div className="text-gray-400 text-sm">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-medium">{loan.collateral}</div>
                  <div className="text-gray-400 text-sm">Collatéral</div>
                </div>
              </div>

              {/* Section droite - Bouton */}
              <Button 
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-full"
              >
                Détails
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default ActiveLoans