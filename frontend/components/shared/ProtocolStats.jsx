import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


const ProtocolStats = () => {
  return (
 
    <div className="w-full">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-18 p-4">
      <Card className="min-w-80 zinc-900 p-6 rounded-lg">
        <CardHeader>
          <CardTitle className="text-gray-400 text-sm">Total Value Loan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">$2.4 M</p>
        </CardContent>
        <CardFooter>
          <p className="text-green-400 text-sm">+12,5% ce mois</p>
        </CardFooter>
      </Card>

      <Card className="min-w-80 bg-zinc-900 p-6 rounded-lg">
        <CardHeader>
          <CardTitle className="text-gray-400 text-sm">Prêts actifs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">156</p>
        </CardContent>
        <CardFooter>
          <p className="text-green-400 text-sm">+ 8 Aujourd'hui</p>
        </CardFooter>
      </Card>

      <Card className=" min-w-80 bg-zinc-900 p-6 rounded-lg">
        <CardHeader>
          <CardTitle className="text-gray-400 text-sm">APY Moyen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">8.4%</p>
        </CardContent>
        <CardFooter>
          <p className="text-green-400 text-sm">+0.3 % cette semaine</p>
        </CardFooter>
      </Card>

      <Card className="min-w-80 bg-zinc-900 p-6 rounded-lg">
        <CardHeader>
          <CardTitle className="text-gray-400 text-sm">Mes Tokens CL</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">1 245</p>
        </CardContent>
        <CardFooter>
          <p className="text-green-400 text-sm">+45 cette semaine</p>
        </CardFooter>
      </Card>

    </div>
    </div>
  )
}

export default ProtocolStats